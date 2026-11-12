import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { conflict, notFound } from '../../common/errors/domain-errors';
import { parseDate, todayUtc, yearRange } from '../../common/utils/dates';
import { toBigInt, toNumber } from '../../common/utils/money';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JournalService } from '../accounting/journal.service';
import { ACCOUNTS } from '../accounting/ledger-math';
import {
  BankMovementResponseDto,
  type CandidateDto,
  type ImportBankMovementsDto,
  type ImportResultDto,
  type ListBankMovementsQueryDto,
  type ReconcileDto,
  type TreasurySummaryDto,
} from './treasury.dto';

const ENTITY_TYPE = 'BANK_MOVEMENT';
const INCLUDE = { journalEntry: { select: { year: true, sequence: true } } } as const;
const DAY_MS = 86_400_000;

export function bankFingerprint(row: {
  account_label: string;
  booked_on: string;
  description: string;
  amount_cents: number;
}): string {
  const normalized = [
    row.account_label.trim().toUpperCase(),
    row.booked_on,
    row.description.toUpperCase().replace(/\s+/g, ' ').trim(),
    String(row.amount_cents),
  ].join('|');
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Extractos bancarios y conciliación. Importar NO crea asientos ni cambia el estado de facturas:
 * solo vincula cada apunte del banco con un asiento ya contabilizado en la cuenta 572.
 */
@Injectable()
export class TreasuryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly journal: JournalService,
  ) {}

  async list(query: ListBankMovementsQueryDto): Promise<BankMovementResponseDto[]> {
    const rows = await this.prisma.bankMovement.findMany({
      where: {
        bookedOn: yearRange(query.year),
        journalEntryId:
          query.status === 'pending'
            ? null
            : query.status === 'reconciled'
              ? { not: null }
              : undefined,
      },
      include: INCLUDE,
      orderBy: [{ bookedOn: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => BankMovementResponseDto.from(row));
  }

  async import(dto: ImportBankMovementsDto): Promise<ImportResultDto> {
    const label = dto.account_label.trim();
    const candidates = new Map<string, Prisma.BankMovementCreateManyInput>();
    for (const row of dto.rows) {
      if (!row.amount_cents) continue;
      const fingerprint = bankFingerprint({ ...row, account_label: label });
      candidates.set(fingerprint, {
        accountLabel: label,
        bookedOn: parseDate(row.booked_on),
        description: row.description.trim(),
        amountCents: toBigInt(row.amount_cents),
        fingerprint,
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.bankMovement.createMany({
        data: [...candidates.values()],
        skipDuplicates: true,
      });
      await this.audit.record(
        {
          action: 'bank_movements.imported',
          entityType: ENTITY_TYPE,
          metadata: { account_label: label, received: dto.rows.length, imported: result.count },
        },
        tx,
      );
      return { imported: result.count, duplicates: dto.rows.length - result.count };
    });
  }

  /**
   * Asientos con una línea en 572 del mismo importe y signo, aún sin conciliar, ordenados por
   * cercanía de fecha. Son sugerencias: el usuario confirma cuál corresponde.
   */
  async candidates(id: string): Promise<CandidateDto[]> {
    const movement = await this.findRowOrFail(id);
    const amount = movement.amountCents;
    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountCode: { startsWith: ACCOUNTS.bank },
        ...(amount > 0n ? { debitCents: amount } : { creditCents: -amount }),
        entry: {
          bankMovements: { none: {} },
          sourceType: { not: 'REVERSAL' },
          reversedBy: { is: null },
        },
      },
      include: { entry: true },
      take: 100,
    });
    const booked = movement.bookedOn.getTime();
    return lines
      .map((line) => ({
        journal_entry_id: line.entryId,
        entry_number: `${line.entry.year}/${line.entry.sequence}`,
        entry_date: line.entry.entryDate.toISOString().slice(0, 10),
        reference: line.entry.reference,
        concept: line.entry.concept,
        amount_cents: toNumber(amount),
        days_apart: Math.round(Math.abs(line.entry.entryDate.getTime() - booked) / DAY_MS),
      }))
      .sort((a, b) => a.days_apart - b.days_apart)
      .slice(0, 20);
  }

  async reconcile(id: string, dto: ReconcileDto): Promise<BankMovementResponseDto> {
    const movement = await this.findRowOrFail(id);
    if (movement.journalEntryId)
      throw conflict('ALREADY_RECONCILED', 'Movement is already reconciled');
    const candidates = await this.candidates(id);
    if (!candidates.some((candidate) => candidate.journal_entry_id === dto.journal_entry_id)) {
      throw conflict('NOT_A_CANDIDATE', 'The entry does not match this bank movement');
    }
    return this.setLink(id, dto.journal_entry_id);
  }

  async unreconcile(id: string): Promise<BankMovementResponseDto> {
    await this.findRowOrFail(id);
    return this.setLink(id, null);
  }

  /** Borra solo el apunte importado; el asiento contable (si lo había) no se toca. */
  async remove(id: string): Promise<void> {
    const before = await this.findRowOrFail(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.bankMovement.delete({ where: { id } });
      await this.audit.record(
        {
          action: 'bank_movements.deleted',
          entityType: ENTITY_TYPE,
          entityId: id,
          before: BankMovementResponseDto.from(before),
        },
        tx,
      );
    });
  }

  async summary(year: number): Promise<TreasurySummaryDto> {
    const range = yearRange(year);
    const today = todayUtc();
    const until = range.lte < today ? range.lte : today;
    const [movements, pending, bank, cash, bankLines, reconciledLines] = await Promise.all([
      this.prisma.bankMovement.count({ where: { bookedOn: range } }),
      this.prisma.bankMovement.count({ where: { bookedOn: range, journalEntryId: null } }),
      this.journal.balanceUntil(ACCOUNTS.bank, until),
      this.journal.balanceUntil(ACCOUNTS.cash, until),
      this.prisma.journalEntry.count({
        where: {
          entryDate: range,
          lines: { some: { accountCode: { startsWith: ACCOUNTS.bank } } },
        },
      }),
      this.prisma.journalEntry.count({
        where: {
          entryDate: range,
          lines: { some: { accountCode: { startsWith: ACCOUNTS.bank } } },
          bankMovements: { some: {} },
        },
      }),
    ]);
    return {
      year,
      movements,
      pending,
      bank_ledger_cents: bank,
      cash_ledger_cents: cash,
      bank_lines_in_year: bankLines,
      bank_lines_reconciled: reconciledLines,
    };
  }

  private async findRowOrFail(id: string) {
    const row = await this.prisma.bankMovement.findUnique({ where: { id }, include: INCLUDE });
    if (!row) throw notFound('Bank movement');
    return row;
  }

  private async setLink(id: string, entryId: string | null): Promise<BankMovementResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.bankMovement.update({
        where: { id },
        data: { journalEntryId: entryId, reconciledAt: entryId ? new Date() : null },
        include: INCLUDE,
      });
      const response = BankMovementResponseDto.from(updated);
      await this.audit.record(
        {
          action: entryId ? 'bank_movements.reconciled' : 'bank_movements.unreconciled',
          entityType: ENTITY_TYPE,
          entityId: id,
          after: response,
        },
        tx,
      );
      return response;
    });
  }
}
