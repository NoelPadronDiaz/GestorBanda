import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { conflict } from '../../common/errors/domain-errors';
import { parseDate, yearRange } from '../../common/utils/dates';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ClosePreviewDto, FiscalYearResponseDto } from './accounting.dto';
import { JournalService } from './journal.service';
import {
  closingLines,
  type DraftLine,
  isPatrimonialAccount,
  isResultAccount,
  type NetBalances,
  openingLinesFromClosing,
  regularizationLines,
} from './ledger-math';

interface ClosePlan {
  ordinaryEntries: number;
  regularization: DraftLine[];
  surplusCents: number;
  closing: DraftLine[];
  blockers: string[];
  warnings: string[];
}

/** Ejercicios: regularización, cierre y apertura del siguiente, en una sola transacción. */
@Injectable()
export class FiscalYearsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly journal: JournalService,
  ) {}

  async list(): Promise<FiscalYearResponseDto[]> {
    const [years, counts] = await Promise.all([
      this.prisma.fiscalYear.findMany({ orderBy: { year: 'desc' } }),
      this.prisma.journalEntry.groupBy({ by: ['year'], _count: true }),
    ]);
    const current = new Date().getUTCFullYear();
    const rows = years.map((row) => ({
      year: row.year,
      status: row.status,
      closed_at: row.closedAt?.toISOString() ?? null,
      entry_count: counts.find((count) => count.year === row.year)?._count ?? 0,
    }));
    if (!rows.some((row) => row.year === current)) {
      rows.unshift({ year: current, status: 'OPEN', closed_at: null, entry_count: 0 });
    }
    return rows;
  }

  async preview(year: number): Promise<ClosePreviewDto> {
    const status = (await this.prisma.fiscalYear.findUnique({ where: { year } }))?.status ?? 'OPEN';
    const plan = await this.plan(this.prisma, year);
    if (status === 'CLOSED') plan.blockers.unshift('YEAR_CLOSED');
    return {
      year,
      status,
      ordinary_entry_count: plan.ordinaryEntries,
      surplus_cents: plan.surplusCents,
      regularization: plan.regularization,
      closing: plan.closing,
      blockers: plan.blockers,
      warnings: plan.warnings,
    };
  }

  async close(year: number, actor: AuthenticatedUser): Promise<ClosePreviewDto> {
    await this.prisma.$transaction(
      async (tx) => {
        await this.journal.lockOpenYear(tx, year);
        const plan = await this.plan(tx, year);
        if (plan.blockers.length) {
          throw conflict(plan.blockers[0], 'The fiscal year cannot be closed', {
            blockers: plan.blockers,
          });
        }
        const yearEnd = parseDate(`${year}-12-31`);
        if (plan.regularization.length) {
          await this.journal.postInTx(
            tx,
            {
              entryDate: yearEnd,
              activity: 'SHARED',
              reference: `REG-${year}`,
              concept: `Regularización del ejercicio ${year}`,
              sourceType: 'REGULARIZATION',
              sourceId: null,
              lines: plan.regularization,
            },
            actor.id,
          );
        }
        // Tras regularizar, las cuentas patrimoniales (incluida la 129) se recalculan dentro de la tx.
        const closing = closingLines(await this.patrimony(tx, year));
        if (closing.length) {
          await this.journal.postInTx(
            tx,
            {
              entryDate: yearEnd,
              activity: 'SHARED',
              reference: `CIE-${year}`,
              concept: `Cierre del ejercicio ${year}`,
              sourceType: 'CLOSING',
              sourceId: null,
              lines: closing,
            },
            actor.id,
          );
          await this.journal.postInTx(
            tx,
            {
              entryDate: parseDate(`${year + 1}-01-01`),
              activity: 'SHARED',
              reference: `APE-${year + 1}`,
              concept: `Apertura desde el cierre de ${year}`,
              sourceType: 'OPENING',
              sourceId: null,
              lines: openingLinesFromClosing(closing),
            },
            actor.id,
          );
        }
        await tx.fiscalYear.update({
          where: { year },
          data: { status: 'CLOSED', closedAt: new Date(), closedById: actor.id },
        });
        await this.audit.record(
          {
            action: 'fiscal_years.closed',
            entityType: 'FISCAL_YEAR',
            entityId: year,
            metadata: { surplus_cents: plan.surplusCents, closing_lines: closing.length },
          },
          tx,
        );
      },
      { timeout: 30_000 },
    );
    return this.preview(year);
  }

  private async plan(tx: Prisma.TransactionClient, year: number): Promise<ClosePlan> {
    const range = yearRange(year);
    const [ordinaryEntries, nextYearEntries, previousEntries, openings, resultNet] =
      await Promise.all([
        tx.journalEntry.count({
          where: { year, sourceType: { notIn: ['REGULARIZATION', 'CLOSING', 'OPENING'] } },
        }),
        tx.journalEntry.count({ where: { year: year + 1 } }),
        tx.journalEntry.count({ where: { entryDate: { lt: range.gte } } }),
        tx.journalEntry.count({ where: { year, sourceType: 'OPENING' } }),
        this.journal.netByAccount({ entryDate: range }, tx),
      ]);

    const results: NetBalances = new Map(
      [...resultNet.entries()]
        .filter(([code]) => isResultAccount(code))
        .map(([code, sums]) => [code, sums.debit - sums.credit]),
    );
    const { lines: regularization, surplusCents } = regularizationLines(results);

    // Vista previa del cierre: patrimonio actual + efecto de la regularización en la 129.
    const patrimony = await this.patrimony(tx, year);
    for (const line of regularization) {
      if (!isPatrimonialAccount(line.account_code)) continue;
      const current = patrimony.get(line.account_code) ?? 0;
      patrimony.set(line.account_code, current + line.debit_cents - line.credit_cents);
    }
    const closing = closingLines(patrimony);
    const patrimonyNet = [...patrimony.values()].reduce((sum, value) => sum + value, 0);

    const blockers: string[] = [];
    const warnings: string[] = [];
    if (!ordinaryEntries) blockers.push('NO_ENTRIES');
    if (nextYearEntries) blockers.push('NEXT_YEAR_HAS_ENTRIES');
    if (patrimonyNet !== 0) blockers.push('PATRIMONY_UNBALANCED');
    if (!previousEntries && !openings) warnings.push('NO_OPENING_BALANCES');
    return { ordinaryEntries, regularization, surplusCents, closing, blockers, warnings };
  }

  /** Saldos de las cuentas 1-5 acumulados hasta el 31/12 del ejercicio. */
  private async patrimony(tx: Prisma.TransactionClient, year: number): Promise<NetBalances> {
    const net = await this.journal.netByAccount({ entryDate: { lte: yearRange(year).lte } }, tx);
    return new Map(
      [...net.entries()]
        .filter(([code]) => isPatrimonialAccount(code))
        .map(([code, sums]) => [code, sums.debit - sums.credit]),
    );
  }
}
