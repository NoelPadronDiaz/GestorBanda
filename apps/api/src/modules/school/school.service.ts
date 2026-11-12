import { Injectable } from '@nestjs/common';
import type { Prisma, SchoolTariffKey, Student } from '@prisma/client';
import { baseFromGross, DEFAULT_IGIC_BP } from '@alcaravan/shared';
import { conflict, invalidField, notFound } from '../../common/errors/domain-errors';
import {
  lastDayOfMonth,
  monthLabelEs,
  monthStart,
  parseDate,
  todayUtc,
  yearRange,
} from '../../common/utils/dates';
import { toBigInt, toNullableNumber, toNumber } from '../../common/utils/money';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InvoicesService } from '../billing/invoices.service';
import { MembersService } from '../members/members.service';
import {
  type CreateStudentDto,
  FeeResponseDto,
  type GenerateFeesDto,
  type GenerateFeesResponseDto,
  type ListFeesQueryDto,
  missingBillingFields,
  type SchoolSummaryDto,
  type SkippedFeeDto,
  StudentResponseDto,
  TariffDto,
  type UpdateStudentDto,
  type UpdateTariffsDto,
} from './school.dto';

const ENTITY_TYPE = 'STUDENT';

type Tariffs = Partial<Record<SchoolTariffKey, number | null>>;

const MODALITY_LABEL: Record<Student['modality'], string> = {
  EARLY_MUSIC: 'Despertar Musical',
  SOLFEGE: 'Solfeo',
  SOLFEGE_INSTRUMENT: 'Solfeo + Instrumento',
  INSTRUMENT: 'Instrumento',
};

/**
 * Cuota mensual de un alumno con las tarifas vigentes (IGIC incluido), o null si no está definida.
 * La tarifa de hermanos solo existe para Solfeo + Instrumento.
 */
export function monthlyFee(student: Student, tariffs: Tariffs): number | null {
  switch (student.tariffKind) {
    case 'CUSTOM':
      return student.customFeeCents === null ? null : Number(student.customFeeCents);
    case 'BAND_MEMBER':
      return tariffs.BAND_MEMBER ?? null;
    case 'SIBLINGS':
      return student.modality === 'SOLFEGE_INSTRUMENT' ? (tariffs.SIBLINGS ?? null) : null;
    case 'ORDINARY':
      return tariffs[student.modality] ?? null;
  }
}

/** Escuela de música: alumnado, tarifas y cuotas mensuales facturadas en la serie ESC. */
@Injectable()
export class SchoolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly invoices: InvoicesService,
    private readonly members: MembersService,
  ) {}

  // ── Alumnado ──

  async listStudents(): Promise<StudentResponseDto[]> {
    const [rows, tariffs] = await Promise.all([
      this.prisma.student.findMany({
        where: { deletedAt: null },
        orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
      }),
      this.tariffMap(),
    ]);
    return rows.map((row) => StudentResponseDto.from(row, monthlyFee(row, tariffs)));
  }

  async createStudent(dto: CreateStudentDto): Promise<StudentResponseDto> {
    this.assertTariffConsistency(dto.tariff_kind ?? 'ORDINARY', dto.modality, dto.custom_fee_cents);
    if (dto.member_id) await this.members.assertExists(dto.member_id);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          fullName: dto.full_name.trim(),
          memberId: dto.member_id ?? null,
          familyLabel: dto.family_label ?? null,
          modality: dto.modality,
          tariffKind: dto.tariff_kind,
          customFeeCents: dto.custom_fee_cents == null ? null : toBigInt(dto.custom_fee_cents),
          status: dto.status,
          enrolledOn: parseDate(dto.enrolled_on) ?? null,
          paymentMethod: dto.payment_method ?? null,
          ...this.billingColumns(dto),
          notes: dto.notes ?? null,
        },
      });
      const response = StudentResponseDto.from(
        created,
        monthlyFee(created, await this.tariffMap(tx)),
      );
      await this.audit.record(
        {
          action: 'students.created',
          entityType: ENTITY_TYPE,
          entityId: created.id,
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  async updateStudent(id: string, dto: UpdateStudentDto): Promise<StudentResponseDto> {
    const before = await this.findStudentOrFail(id);
    this.assertTariffConsistency(
      dto.tariff_kind ?? before.tariffKind,
      dto.modality ?? before.modality,
      dto.custom_fee_cents === undefined
        ? toNullableNumber(before.customFeeCents)
        : dto.custom_fee_cents,
    );
    if (dto.member_id) await this.members.assertExists(dto.member_id);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.student.update({
        where: { id },
        data: {
          fullName: dto.full_name?.trim() ?? undefined,
          memberId: dto.member_id,
          familyLabel: dto.family_label,
          modality: dto.modality ?? undefined,
          tariffKind: dto.tariff_kind ?? undefined,
          customFeeCents:
            dto.custom_fee_cents === undefined
              ? undefined
              : dto.custom_fee_cents === null
                ? null
                : toBigInt(dto.custom_fee_cents),
          status: dto.status ?? undefined,
          enrolledOn: parseDate(dto.enrolled_on),
          paymentMethod: dto.payment_method,
          ...this.billingColumns(dto),
          notes: dto.notes,
        },
      });
      const tariffs = await this.tariffMap(tx);
      const response = StudentResponseDto.from(updated, monthlyFee(updated, tariffs));
      await this.audit.record(
        {
          action: 'students.updated',
          entityType: ENTITY_TYPE,
          entityId: id,
          before: StudentResponseDto.from(before, monthlyFee(before, tariffs)),
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  /** Borrado lógico; con cuotas emitidas solo se permite dar de baja (status WITHDRAWN). */
  async removeStudent(id: string): Promise<void> {
    const before = await this.findStudentOrFail(id);
    if (await this.prisma.studentFee.count({ where: { studentId: id } })) {
      throw conflict('STUDENT_HAS_FEES', 'Student has fees; mark it as withdrawn instead');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.student.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(
        {
          action: 'students.deleted',
          entityType: ENTITY_TYPE,
          entityId: id,
          before: StudentResponseDto.from(before, null),
        },
        tx,
      );
    });
  }

  // ── Tarifas ──

  async listTariffs(): Promise<TariffDto[]> {
    const rows = await this.prisma.schoolTariff.findMany({ orderBy: { key: 'asc' } });
    return rows.map((row) => TariffDto.from(row));
  }

  /** Cambiar tarifas no altera cuotas ya emitidas: solo las que se generen después. */
  async updateTariffs(dto: UpdateTariffsDto): Promise<TariffDto[]> {
    const before = await this.listTariffs();
    await this.prisma.$transaction(async (tx) => {
      for (const tariff of dto.tariffs) {
        const amountCents = tariff.amount_cents == null ? null : toBigInt(tariff.amount_cents);
        await tx.schoolTariff.upsert({
          where: { key: tariff.key },
          create: { key: tariff.key, amountCents },
          update: { amountCents },
        });
      }
      await this.audit.record(
        {
          action: 'school_tariffs.updated',
          entityType: 'SCHOOL_TARIFF',
          before,
          after: dto.tariffs,
        },
        tx,
      );
    });
    return this.listTariffs();
  }

  // ── Cuotas ──

  async listFees(query: ListFeesQueryDto): Promise<FeeResponseDto[]> {
    const rows = await this.prisma.studentFee.findMany({
      where: {
        period: query.period ? monthStart(query.period) : undefined,
        studentId: query.student_id,
      },
      include: { student: true, invoice: true },
      orderBy: [{ period: 'desc' }, { student: { fullName: 'asc' } }],
    });
    return rows.map((row) => FeeResponseDto.from(row));
  }

  /**
   * Genera la cuota del mes y su factura ESC (IGIC incluido) para cada alumno activo que aún no la
   * tenga. Los que no tienen tarifa o datos de facturación se devuelven en `skipped` sin bloquear al
   * resto. Todas las cuotas creadas se confirman juntas o ninguna.
   */
  async generateFees(dto: GenerateFeesDto): Promise<GenerateFeesResponseDto> {
    const period = monthStart(dto.period);
    const lastDay = lastDayOfMonth(dto.period);
    const issueDate = dto.issue_date ? parseDate(dto.issue_date) : todayUtc();
    const [students, existing, tariffs] = await Promise.all([
      this.prisma.student.findMany({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          OR: [{ enrolledOn: null }, { enrolledOn: { lte: lastDay } }],
        },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.studentFee.findMany({ where: { period }, select: { studentId: true } }),
      this.tariffMap(),
    ]);
    const already = new Set(existing.map((fee) => fee.studentId));
    const skipped: SkippedFeeDto[] = [];
    const toCreate: { student: Student; amount: number; baseCents: number }[] = [];

    for (const student of students) {
      if (already.has(student.id)) continue;
      const amount = monthlyFee(student, tariffs);
      const missing = missingBillingFields(student);
      const skip = (reason: string, fields: string[] = []) =>
        skipped.push({
          student_id: student.id,
          student_name: student.fullName,
          reason,
          missing_fields: fields,
        });
      if (!amount) {
        skip('NO_TARIFF');
        continue;
      }
      if (missing.length) {
        skip('MISSING_BILLING_DATA', missing);
        continue;
      }
      const { base_cents, exact } = baseFromGross(amount, DEFAULT_IGIC_BP);
      if (!exact) {
        skip('AMOUNT_NOT_EXACT');
        continue;
      }
      toCreate.push({ student, amount, baseCents: base_cents });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const fees: FeeResponseDto[] = [];
      for (const { student, amount, baseCents } of toCreate) {
        const invoice = await this.invoices.issueInTx(tx, {
          series: 'ESC',
          issueDate,
          operationDate: lastDay,
          clientId: null,
          recipient: {
            name: student.billingName!.trim(),
            taxId: student.billingTaxId!.trim(),
            address: student.billingAddress!.trim(),
            city: student.billingCity!.trim(),
            email: student.billingEmail?.trim() || null,
          },
          taxRateBp: DEFAULT_IGIC_BP,
          withholdingRateBp: 0,
          notes: `Mensualidad correspondiente a ${monthLabelEs(dto.period)}`,
          lines: [
            {
              description: `Cuota de ${MODALITY_LABEL[student.modality]} — ${monthLabelEs(dto.period)} · Alumno/a: ${student.fullName}`,
              quantity: 1,
              unit_price: baseCents / 100,
            },
          ],
        });
        if (Number(invoice.totalCents) !== amount) {
          throw conflict('FEE_TOTAL_MISMATCH', 'Generated invoice total does not match the fee');
        }
        const fee = await tx.studentFee.create({
          data: {
            studentId: student.id,
            period,
            amountCents: toBigInt(amount),
            invoiceId: invoice.id,
          },
          include: { student: true, invoice: true },
        });
        const response = FeeResponseDto.from(fee);
        await this.audit.record(
          {
            action: 'student_fees.created',
            entityType: 'STUDENT_FEE',
            entityId: fee.id,
            after: response,
          },
          tx,
        );
        fees.push(response);
      }
      return fees;
    });

    return { created, skipped, already_existing: already.size };
  }

  async summary(year: number): Promise<SchoolSummaryDto> {
    const where: Prisma.StudentFeeWhereInput = { period: yearRange(year) };
    const [activeStudents, all, pending] = await Promise.all([
      this.prisma.student.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.studentFee.aggregate({ where, _sum: { amountCents: true } }),
      this.prisma.studentFee.aggregate({
        where: { ...where, invoice: { status: 'PENDING' } },
        _sum: { amountCents: true },
        _count: true,
      }),
    ]);
    return {
      active_students: activeStudents,
      fees_total_cents: toNumber(all._sum.amountCents),
      fees_pending_cents: toNumber(pending._sum.amountCents),
      fees_pending_count: pending._count,
    };
  }

  private async findStudentOrFail(id: string): Promise<Student> {
    const row = await this.prisma.student.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw notFound('Student');
    return row;
  }

  private async tariffMap(tx: Prisma.TransactionClient = this.prisma): Promise<Tariffs> {
    const rows = await tx.schoolTariff.findMany();
    return Object.fromEntries(
      rows.map((row) => [row.key, row.amountCents === null ? null : Number(row.amountCents)]),
    );
  }

  private assertTariffConsistency(
    kind: Student['tariffKind'],
    modality: Student['modality'],
    customFee: number | null | undefined,
  ): void {
    if (kind === 'SIBLINGS' && modality !== 'SOLFEGE_INSTRUMENT') {
      throw invalidField('tariff_kind', 'The siblings tariff only applies to SOLFEGE_INSTRUMENT');
    }
    if (kind === 'CUSTOM' && (customFee === null || customFee === undefined)) {
      throw invalidField('custom_fee_cents', 'custom_fee_cents is required with a CUSTOM tariff');
    }
  }

  private billingColumns(dto: UpdateStudentDto) {
    const clean = (value: string | null | undefined) =>
      value === undefined ? undefined : value?.trim() || null;
    return {
      billingName: clean(dto.billing_name),
      billingTaxId: clean(dto.billing_tax_id),
      billingAddress: clean(dto.billing_address),
      billingCity: clean(dto.billing_city),
      billingEmail: clean(dto.billing_email),
      billingPhone: clean(dto.billing_phone),
    };
  }
}
