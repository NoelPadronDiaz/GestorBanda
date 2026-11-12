import { Injectable } from '@nestjs/common';
import type { InternalCashMovement, Prisma } from '@prisma/client';
import { notFound } from '../../common/errors/domain-errors';
import { parseDate } from '../../common/utils/dates';
import { toBigInt, toNumber } from '../../common/utils/money';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  type CashQueryDto,
  CashMovementResponseDto,
  type CashReportDto,
  type CreateCashMovementDto,
  type UpdateCashMovementDto,
} from './internal-cash.dto';

const ENTITY_TYPE = 'INTERNAL_CASH_MOVEMENT';

/**
 * Tesorería interna: libro auxiliar de control (rifas, refuerzos, eventos, caja). No toca el
 * diario, ni facturas, ni IGIC. Registrarlo aquí no exime de contabilizar lo que corresponda.
 */
@Injectable()
export class InternalCashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async report(query: CashQueryDto): Promise<CashReportDto> {
    const from = parseDate(query.from);
    const to = parseDate(query.to);
    const base: Prisma.InternalCashMovementWhereInput = {
      deletedAt: null,
      activity: query.activity,
    };
    const inPeriod: Prisma.InternalCashMovementWhereInput = {
      ...base,
      occurredOn: { gte: from ?? undefined, lte: to ?? undefined },
    };
    const [rows, totals, balance, pending] = await Promise.all([
      this.prisma.internalCashMovement.findMany({
        where: inPeriod,
        orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.internalCashMovement.groupBy({
        by: ['direction'],
        where: inPeriod,
        _sum: { amountCents: true },
      }),
      this.prisma.internalCashMovement.groupBy({
        by: ['direction'],
        where: { ...base, occurredOn: to ? { lte: to } : undefined },
        _sum: { amountCents: true },
      }),
      this.prisma.internalCashMovement.count({ where: { ...inPeriod, review: 'PENDING' } }),
    ]);
    const pick = (groups: typeof totals, direction: 'IN' | 'OUT') =>
      toNumber(groups.find((group) => group.direction === direction)?._sum.amountCents);
    return {
      movements: rows.map((row) => CashMovementResponseDto.from(row)),
      in_cents: pick(totals, 'IN'),
      out_cents: pick(totals, 'OUT'),
      balance_cents: pick(balance, 'IN') - pick(balance, 'OUT'),
      pending_review: pending,
    };
  }

  async create(dto: CreateCashMovementDto): Promise<CashMovementResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.internalCashMovement.create({
        data: {
          occurredOn: parseDate(dto.occurred_on),
          direction: dto.direction,
          amountCents: toBigInt(dto.amount_cents),
          activity: dto.activity,
          category: dto.category,
          concept: dto.concept.trim(),
          notes: dto.notes?.trim() || null,
          review: dto.review,
        },
      });
      const response = CashMovementResponseDto.from(created);
      await this.audit.record(
        {
          action: 'internal_cash.created',
          entityType: ENTITY_TYPE,
          entityId: created.id,
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  async update(id: string, dto: UpdateCashMovementDto): Promise<CashMovementResponseDto> {
    const before = await this.findRowOrFail(id);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.internalCashMovement.update({
        where: { id },
        data: {
          occurredOn: dto.occurred_on ? parseDate(dto.occurred_on) : undefined,
          direction: dto.direction ?? undefined,
          amountCents: dto.amount_cents === undefined ? undefined : toBigInt(dto.amount_cents),
          activity: dto.activity ?? undefined,
          category: dto.category ?? undefined,
          concept: dto.concept?.trim() ?? undefined,
          notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
          review: dto.review ?? undefined,
        },
      });
      const response = CashMovementResponseDto.from(updated);
      await this.audit.record(
        {
          action: 'internal_cash.updated',
          entityType: ENTITY_TYPE,
          entityId: id,
          before: CashMovementResponseDto.from(before),
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  async remove(id: string): Promise<void> {
    const before = await this.findRowOrFail(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.internalCashMovement.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(
        {
          action: 'internal_cash.deleted',
          entityType: ENTITY_TYPE,
          entityId: id,
          before: CashMovementResponseDto.from(before),
        },
        tx,
      );
    });
  }

  private async findRowOrFail(id: string): Promise<InternalCashMovement> {
    const row = await this.prisma.internalCashMovement.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) throw notFound('Cash movement');
    return row;
  }
}
