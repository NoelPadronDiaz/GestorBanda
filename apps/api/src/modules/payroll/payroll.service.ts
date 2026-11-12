import { Injectable } from '@nestjs/common';
import type { PaymentMethod, Payroll, Prisma, Worker } from '@prisma/client';
import { conflict, invalidField, notFound } from '../../common/errors/domain-errors';
import { monthStart, parseDate, periodOf, yearRange } from '../../common/utils/dates';
import { toBigInt, toNumber } from '../../common/utils/money';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MembersService } from '../members/members.service';
import {
  type CreatePayrollDto,
  type CreateWorkerDto,
  type ListPayrollsQueryDto,
  type MarkPayrollPaidDto,
  PayrollResponseDto,
  type UpdatePayrollDto,
  type UpdateWorkerDto,
  WorkerResponseDto,
} from './payroll.dto';

export type PayrollWithWorker = Payroll & { worker: Worker };

interface PayrollAmounts {
  gross: number;
  employeeSs: number;
  irpf: number;
  other: number;
  employerSs: number;
}

/**
 * Personal y nóminas. Se registran los importes de la nómina oficial (no es un programa de nóminas);
 * la contabilización la propone el módulo de Contabilidad.
 */
@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly members: MembersService,
  ) {}

  // ── Trabajadores ──

  async listWorkers(): Promise<WorkerResponseDto[]> {
    const rows = await this.prisma.worker.findMany({
      where: { deletedAt: null },
      orderBy: [{ active: 'desc' }, { fullName: 'asc' }],
    });
    return rows.map((row) => WorkerResponseDto.from(row));
  }

  async createWorker(dto: CreateWorkerDto): Promise<WorkerResponseDto> {
    if (dto.member_id) await this.members.assertExists(dto.member_id);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.worker.create({
        data: {
          fullName: dto.full_name.trim(),
          roleTitle: dto.role_title?.trim() || null,
          memberId: dto.member_id ?? null,
          activity: dto.activity,
          active: dto.active ?? true,
        },
      });
      const response = WorkerResponseDto.from(created);
      await this.audit.record(
        { action: 'workers.created', entityType: 'WORKER', entityId: created.id, after: response },
        tx,
      );
      return response;
    });
  }

  async updateWorker(id: string, dto: UpdateWorkerDto): Promise<WorkerResponseDto> {
    const before = await this.findWorkerOrFail(id);
    if (dto.member_id) await this.members.assertExists(dto.member_id);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.worker.update({
        where: { id },
        data: {
          fullName: dto.full_name?.trim() ?? undefined,
          roleTitle: dto.role_title === undefined ? undefined : dto.role_title?.trim() || null,
          memberId: dto.member_id,
          activity: dto.activity ?? undefined,
          active: dto.active ?? undefined,
        },
      });
      const response = WorkerResponseDto.from(updated);
      await this.audit.record(
        {
          action: 'workers.updated',
          entityType: 'WORKER',
          entityId: id,
          before: WorkerResponseDto.from(before),
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  async removeWorker(id: string): Promise<void> {
    const before = await this.findWorkerOrFail(id);
    const [payrolls, recurring] = await Promise.all([
      this.prisma.payroll.count({ where: { workerId: id } }),
      this.prisma.recurringExpense.count({ where: { workerId: id } }),
    ]);
    if (payrolls || recurring) {
      throw conflict('WORKER_IN_USE', 'Worker has payrolls or recurring templates; deactivate it');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.worker.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(
        {
          action: 'workers.deleted',
          entityType: 'WORKER',
          entityId: id,
          before: WorkerResponseDto.from(before),
        },
        tx,
      );
    });
  }

  // ── Nóminas ──

  async listPayrolls(query: ListPayrollsQueryDto): Promise<PayrollResponseDto[]> {
    const rows = await this.prisma.payroll.findMany({
      where: { period: query.year ? yearRange(query.year) : undefined, workerId: query.worker_id },
      include: { worker: true },
      orderBy: [{ period: 'desc' }, { worker: { fullName: 'asc' } }],
    });
    return rows.map((row) => PayrollResponseDto.from(row));
  }

  async createPayroll(dto: CreatePayrollDto): Promise<PayrollResponseDto> {
    await this.findWorkerOrFail(dto.worker_id);
    this.assertAccrualInPeriod(dto.period, dto.accrual_date);
    const amounts = this.amounts(dto);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.payroll.create({
        data: {
          workerId: dto.worker_id,
          period: monthStart(dto.period),
          accrualDate: parseDate(dto.accrual_date),
          activity: dto.activity,
          ...this.amountColumns(amounts),
          notes: dto.notes?.trim() || null,
        },
        include: { worker: true },
      });
      const response = PayrollResponseDto.from(created);
      await this.audit.record(
        {
          action: 'payrolls.created',
          entityType: 'PAYROLL',
          entityId: created.id,
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  async updatePayroll(id: string, dto: UpdatePayrollDto): Promise<PayrollResponseDto> {
    const before = await this.findPayrollOrFail(id);
    if (before.journalEntryId) {
      throw conflict('PAYROLL_ACCOUNTED', 'Payroll is accounted; reverse its journal entry first');
    }
    if (dto.worker_id) await this.findWorkerOrFail(dto.worker_id);
    const period = dto.period ?? periodOf(before.period);
    const accrual = dto.accrual_date ?? before.accrualDate.toISOString().slice(0, 10);
    this.assertAccrualInPeriod(period, accrual);
    const amounts = this.amounts({
      gross_cents: dto.gross_cents ?? toNumber(before.grossCents),
      employee_ss_cents: dto.employee_ss_cents ?? toNumber(before.employeeSsCents),
      irpf_cents: dto.irpf_cents ?? toNumber(before.irpfCents),
      other_deductions_cents: dto.other_deductions_cents ?? toNumber(before.otherDeductionsCents),
      employer_ss_cents: dto.employer_ss_cents ?? toNumber(before.employerSsCents),
    });
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payroll.update({
        where: { id },
        data: {
          workerId: dto.worker_id ?? undefined,
          period: monthStart(period),
          accrualDate: parseDate(accrual),
          activity: dto.activity ?? undefined,
          ...this.amountColumns(amounts),
          notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
        },
        include: { worker: true },
      });
      const response = PayrollResponseDto.from(updated);
      await this.audit.record(
        {
          action: 'payrolls.updated',
          entityType: 'PAYROLL',
          entityId: id,
          before: PayrollResponseDto.from(before),
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  async markPaid(id: string, dto: MarkPayrollPaidDto): Promise<PayrollResponseDto> {
    const before = await this.findPayrollOrFail(id);
    return this.setPayment(before, parseDate(dto.paid_on), dto.payment_method);
  }

  async markPending(id: string): Promise<PayrollResponseDto> {
    const before = await this.findPayrollOrFail(id);
    if (before.paymentEntryId) {
      throw conflict(
        'PAYMENT_ACCOUNTED',
        'The payment is accounted; reverse its journal entry first',
      );
    }
    return this.setPayment(before, null, null);
  }

  async removePayroll(id: string): Promise<void> {
    const before = await this.findPayrollOrFail(id);
    if (before.journalEntryId || before.status === 'PAID') {
      throw conflict('PAYROLL_LOCKED', 'Only unpaid, unaccounted payrolls can be deleted');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.payroll.delete({ where: { id } });
      await this.audit.record(
        {
          action: 'payrolls.deleted',
          entityType: 'PAYROLL',
          entityId: id,
          before: PayrollResponseDto.from(before),
        },
        tx,
      );
    });
  }

  // ── Usados por Contabilidad y Fiscalidad ──

  async findPayrollOrFail(
    id: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<PayrollWithWorker> {
    const row = await tx.payroll.findUnique({ where: { id }, include: { worker: true } });
    if (!row) throw notFound('Payroll');
    return row;
  }

  async linkAccrualEntry(
    tx: Prisma.TransactionClient,
    id: string,
    entryId: string | null,
  ): Promise<void> {
    await tx.payroll.update({ where: { id }, data: { journalEntryId: entryId } });
  }

  async linkPaymentEntry(
    tx: Prisma.TransactionClient,
    id: string,
    payment: { entryId: string; paidOn: Date; method: PaymentMethod } | null,
  ): Promise<void> {
    await tx.payroll.update({
      where: { id },
      data: payment
        ? {
            paymentEntryId: payment.entryId,
            status: 'PAID',
            paidOn: payment.paidOn,
            paymentMethod: payment.method,
          }
        : { paymentEntryId: null, status: 'PENDING', paidOn: null, paymentMethod: null },
    });
  }

  /** Nóminas con IRPF pagadas en el periodo (rendimientos del trabajo, modelos 111/190). */
  async listWithholdingsPaidBetween(from: Date, to: Date): Promise<PayrollWithWorker[]> {
    return this.prisma.payroll.findMany({
      where: { status: 'PAID', paidOn: { gte: from, lte: to }, irpfCents: { gt: 0 } },
      include: { worker: true },
      orderBy: [{ paidOn: 'asc' }],
    });
  }

  private async findWorkerOrFail(id: string): Promise<Worker> {
    const row = await this.prisma.worker.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw notFound('Worker');
    return row;
  }

  private assertAccrualInPeriod(period: string, accrualDate: string): void {
    if (!accrualDate.startsWith(period)) {
      throw invalidField('accrual_date', 'accrual_date must be within the payroll month');
    }
  }

  private amounts(dto: {
    gross_cents: number;
    employee_ss_cents: number;
    irpf_cents: number;
    other_deductions_cents: number;
    employer_ss_cents: number;
  }): PayrollAmounts {
    const amounts = {
      gross: dto.gross_cents,
      employeeSs: dto.employee_ss_cents,
      irpf: dto.irpf_cents,
      other: dto.other_deductions_cents,
      employerSs: dto.employer_ss_cents,
    };
    if (
      amounts.gross <= 0 ||
      amounts.gross - amounts.employeeSs - amounts.irpf - amounts.other <= 0
    ) {
      throw invalidField('gross_cents', 'Gross and net pay must be positive');
    }
    return amounts;
  }

  private amountColumns(a: PayrollAmounts) {
    return {
      grossCents: toBigInt(a.gross),
      employeeSsCents: toBigInt(a.employeeSs),
      irpfCents: toBigInt(a.irpf),
      otherDeductionsCents: toBigInt(a.other),
      employerSsCents: toBigInt(a.employerSs),
      netCents: toBigInt(a.gross - a.employeeSs - a.irpf - a.other),
    };
  }

  private async setPayment(
    before: PayrollWithWorker,
    paidOn: Date | null,
    method: PaymentMethod | null,
  ): Promise<PayrollResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payroll.update({
        where: { id: before.id },
        data: { status: paidOn ? 'PAID' : 'PENDING', paidOn, paymentMethod: method },
        include: { worker: true },
      });
      const response = PayrollResponseDto.from(updated);
      await this.audit.record(
        {
          action: paidOn ? 'payrolls.marked_paid' : 'payrolls.marked_pending',
          entityType: 'PAYROLL',
          entityId: before.id,
          before: { status: before.status, paid_on: before.paidOn },
          after: { status: response.status, paid_on: response.paid_on },
        },
        tx,
      );
      return response;
    });
  }
}
