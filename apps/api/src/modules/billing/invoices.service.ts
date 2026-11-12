import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type Invoice,
  type InvoiceLine,
  type InvoiceSeries,
  type PaymentMethod,
} from '@prisma/client';
import { invoiceTotals, lineAmountCents } from '@alcaravan/shared';
import { paginationMeta, skipTake } from '../../common/dto/pagination.dto';
import { conflict, invalidField, notFound } from '../../common/errors/domain-errors';
import { parseDate, yearRange } from '../../common/utils/dates';
import { percentToBp, toBigInt } from '../../common/utils/money';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClientsService } from './clients.service';
import {
  type CreateInvoiceDto,
  InvoiceResponseDto,
  type InvoiceLineDto,
  type ListInvoicesQueryDto,
  type MarkPaidDto,
  type PaginatedInvoicesDto,
  type UpdateInvoiceDto,
} from './invoices.dto';

const ENTITY_TYPE = 'INVOICE';

export type InvoiceWithLines = Invoice & {
  lines: InvoiceLine[];
  studentFee: { id: string } | null;
};

export interface InvoiceRecipient {
  name: string;
  taxId: string | null;
  address: string | null;
  city: string | null;
  email: string | null;
}

/** Datos para emitir una factura desde otro módulo (p. ej. cuotas de la escuela). */
export interface IssueInvoiceInput {
  series: InvoiceSeries;
  issueDate: Date;
  operationDate: Date | null;
  clientId: string | null;
  recipient: InvoiceRecipient;
  taxRateBp: number;
  withholdingRateBp: number;
  notes: string | null;
  lines: { description: string; quantity: number; unit_price: number }[];
}

const INCLUDE = { lines: true, studentFee: { select: { id: true } } } as const;

export function invoiceCode(series: InvoiceSeries, year: number, number: number): string {
  return `${series}-${year}-${String(number).padStart(3, '0')}`;
}

/** Propietario de invoice, invoice_line e invoice_sequence. */
@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clients: ClientsService,
  ) {}

  async list(query: ListInvoicesQueryDto): Promise<PaginatedInvoicesDto> {
    const search = query.q?.trim();
    const where: Prisma.InvoiceWhereInput = {
      year: query.year,
      series: query.series,
      status: query.status,
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { recipientName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ issueDate: 'desc' }, { code: 'desc' }],
        ...skipTake(query),
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return {
      data: rows.map((row) => InvoiceResponseDto.from(row)),
      meta: paginationMeta(query, total),
    };
  }

  async findOneOrFail(id: string): Promise<InvoiceResponseDto> {
    return InvoiceResponseDto.from(await this.findRowOrFail(id));
  }

  async findRowOrFail(
    id: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<InvoiceWithLines> {
    const row = await tx.invoice.findUnique({ where: { id }, include: INCLUDE });
    if (!row) throw notFound('Invoice');
    return row;
  }

  /** Vista previa del siguiente número (el definitivo se asigna al guardar). */
  async peekNextCode(series: InvoiceSeries, year: number): Promise<string> {
    const sequence = await this.prisma.invoiceSequence.findUnique({
      where: { series_year: { series, year } },
    });
    return invoiceCode(series, year, (sequence?.lastNumber ?? 0) + 1);
  }

  async create(dto: CreateInvoiceDto): Promise<InvoiceResponseDto> {
    const client = await this.clients.findRowOrFail(dto.client_id);
    return this.prisma.$transaction(async (tx) => {
      const invoice = await this.issueInTx(tx, {
        series: dto.series,
        issueDate: parseDate(dto.issue_date),
        operationDate: parseDate(dto.operation_date) ?? null,
        clientId: client.id,
        recipient: {
          name: client.name,
          taxId: client.taxId,
          address: client.addressLine,
          city: client.city,
          email: client.email,
        },
        taxRateBp: percentToBp(dto.tax_rate),
        withholdingRateBp: percentToBp(dto.withholding_rate ?? 0),
        notes: dto.notes ?? null,
        lines: dto.lines,
      });
      return InvoiceResponseDto.from(invoice);
    });
  }

  /**
   * Emite una factura dentro de una transacción ajena. El número sale de invoice_sequence con un
   * upsert atómico: si la transacción se revierte, el contador también, y no quedan huecos.
   */
  async issueInTx(
    tx: Prisma.TransactionClient,
    input: IssueInvoiceInput,
  ): Promise<InvoiceWithLines> {
    const year = input.issueDate.getUTCFullYear();
    const [{ last_number: number }] = await tx.$queryRaw<{ last_number: number }[]>`
      INSERT INTO "invoice_sequence" ("series", "year", "last_number")
      VALUES (${input.series}::"InvoiceSeries", ${year}, 1)
      ON CONFLICT ("series", "year")
      DO UPDATE SET "last_number" = "invoice_sequence"."last_number" + 1
      RETURNING "last_number"`;

    const totals = invoiceTotals(input.lines, input.taxRateBp, input.withholdingRateBp);
    const created = await tx.invoice.create({
      data: {
        series: input.series,
        year,
        number,
        code: invoiceCode(input.series, year, number),
        issueDate: input.issueDate,
        operationDate: input.operationDate,
        clientId: input.clientId,
        recipientName: input.recipient.name,
        recipientTaxId: input.recipient.taxId,
        recipientAddress: input.recipient.address,
        recipientCity: input.recipient.city,
        recipientEmail: input.recipient.email,
        taxRateBp: input.taxRateBp,
        withholdingRateBp: input.withholdingRateBp,
        baseCents: toBigInt(totals.base_cents),
        taxCents: toBigInt(totals.tax_cents),
        withholdingCents: toBigInt(totals.withholding_cents),
        totalCents: toBigInt(totals.total_cents),
        notes: input.notes,
        lines: { create: this.lineRows(input.lines) },
      },
      include: INCLUDE,
    });
    await this.audit.record(
      {
        action: 'invoices.created',
        entityType: ENTITY_TYPE,
        entityId: created.id,
        after: InvoiceResponseDto.from(created),
      },
      tx,
    );
    return created;
  }

  async update(id: string, dto: UpdateInvoiceDto): Promise<InvoiceResponseDto> {
    const before = await this.findRowOrFail(id);
    this.assertEditable(before);
    if (dto.issue_date && parseDate(dto.issue_date).getUTCFullYear() !== before.year) {
      throw invalidField('issue_date', 'issue_date must stay in the invoice numbering year');
    }
    const client = dto.client_id ? await this.clients.findRowOrFail(dto.client_id) : null;
    const lines =
      dto.lines ??
      before.lines.map((line) => ({
        description: line.description,
        quantity: line.quantity.toNumber(),
        unit_price: line.unitPrice.toNumber(),
      }));
    const taxRateBp = dto.tax_rate === undefined ? before.taxRateBp : percentToBp(dto.tax_rate);
    const withholdingRateBp =
      dto.withholding_rate === undefined
        ? before.withholdingRateBp
        : percentToBp(dto.withholding_rate);
    const totals = invoiceTotals(lines, taxRateBp, withholdingRateBp);

    return this.prisma.$transaction(async (tx) => {
      if (dto.lines) await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          issueDate: dto.issue_date ? parseDate(dto.issue_date) : undefined,
          operationDate: parseDate(dto.operation_date),
          ...(client
            ? {
                clientId: client.id,
                recipientName: client.name,
                recipientTaxId: client.taxId,
                recipientAddress: client.addressLine,
                recipientCity: client.city,
                recipientEmail: client.email,
              }
            : {}),
          taxRateBp,
          withholdingRateBp,
          baseCents: toBigInt(totals.base_cents),
          taxCents: toBigInt(totals.tax_cents),
          withholdingCents: toBigInt(totals.withholding_cents),
          totalCents: toBigInt(totals.total_cents),
          notes: dto.notes,
          ...(dto.lines ? { lines: { create: this.lineRows(dto.lines) } } : {}),
        },
        include: INCLUDE,
      });
      const response = InvoiceResponseDto.from(updated);
      await this.audit.record(
        {
          action: 'invoices.updated',
          entityType: ENTITY_TYPE,
          entityId: id,
          before: InvoiceResponseDto.from(before),
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  /** Marcar cobro sin asiento (seguimiento operativo). El cobro contabilizado lo marca Contabilidad. */
  async markPaid(id: string, dto: MarkPaidDto): Promise<InvoiceResponseDto> {
    const before = await this.findRowOrFail(id);
    if (before.status === 'CANCELLED') throw conflict('INVOICE_CANCELLED', 'Invoice is cancelled');
    return this.setPayment(
      before,
      'PAID',
      parseDate(dto.paid_on),
      dto.payment_method,
      'invoices.marked_paid',
    );
  }

  async markPending(id: string): Promise<InvoiceResponseDto> {
    const before = await this.findRowOrFail(id);
    if (before.paymentEntryId) {
      throw conflict(
        'PAYMENT_ACCOUNTED',
        'The payment is accounted; reverse its journal entry first',
      );
    }
    if (before.status !== 'PAID') return InvoiceResponseDto.from(before);
    return this.setPayment(before, 'PENDING', null, null, 'invoices.marked_pending');
  }

  /**
   * Anula sin borrar: el número queda consumido y la factura visible. Solo si no está contabilizada
   * ni procede de una cuota (en ese caso habría que emitir una rectificativa).
   */
  async cancel(id: string): Promise<InvoiceResponseDto> {
    const before = await this.findRowOrFail(id);
    this.assertEditable(before);
    if (before.status === 'PAID')
      throw conflict('INVOICE_PAID', 'Paid invoices cannot be cancelled');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: INCLUDE,
      });
      const response = InvoiceResponseDto.from(updated);
      await this.audit.record(
        { action: 'invoices.cancelled', entityType: ENTITY_TYPE, entityId: id, after: response },
        tx,
      );
      return response;
    });
  }

  // ── Usados por Contabilidad dentro de su transacción ──

  async linkAccrualEntry(
    tx: Prisma.TransactionClient,
    id: string,
    entryId: string | null,
  ): Promise<void> {
    await tx.invoice.update({ where: { id }, data: { journalEntryId: entryId } });
  }

  async linkPaymentEntry(
    tx: Prisma.TransactionClient,
    id: string,
    payment: { entryId: string; paidOn: Date; method: PaymentMethod } | null,
  ): Promise<void> {
    await tx.invoice.update({
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

  /** Facturas no anuladas de un periodo (libro de IGIC repercutido y panel). */
  async listIssuedBetween(from: Date, to: Date): Promise<Invoice[]> {
    return this.prisma.invoice.findMany({
      where: { issueDate: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
      orderBy: [{ issueDate: 'asc' }, { code: 'asc' }],
    });
  }

  async yearSummary(year: number): Promise<{
    count: number;
    total_cents: number;
    pending_count: number;
    pending_cents: number;
  }> {
    const where = { issueDate: yearRange(year), status: { not: 'CANCELLED' as const } };
    const [all, pending] = await Promise.all([
      this.prisma.invoice.aggregate({ where, _count: true, _sum: { totalCents: true } }),
      this.prisma.invoice.aggregate({
        where: { ...where, status: 'PENDING' },
        _count: true,
        _sum: { totalCents: true },
      }),
    ]);
    return {
      count: all._count,
      total_cents: Number(all._sum.totalCents ?? 0),
      pending_count: pending._count,
      pending_cents: Number(pending._sum.totalCents ?? 0),
    };
  }

  private assertEditable(invoice: InvoiceWithLines): void {
    if (invoice.status === 'CANCELLED') throw conflict('INVOICE_CANCELLED', 'Invoice is cancelled');
    if (invoice.journalEntryId) {
      throw conflict('INVOICE_ACCOUNTED', 'Invoice is accounted; reverse its journal entry first');
    }
    if (invoice.studentFee) {
      throw conflict('INVOICE_FROM_FEE', 'Invoices generated from school fees cannot be edited');
    }
  }

  private lineRows(lines: InvoiceLineDto[]): Prisma.InvoiceLineCreateWithoutInvoiceInput[] {
    return lines.map((line, index) => ({
      position: index + 1,
      description: line.description.trim(),
      quantity: new Prisma.Decimal(line.quantity),
      unitPrice: new Prisma.Decimal(line.unit_price),
      amountCents: toBigInt(lineAmountCents(line.quantity, line.unit_price)),
    }));
  }

  private async setPayment(
    before: InvoiceWithLines,
    status: 'PAID' | 'PENDING',
    paidOn: Date | null,
    method: PaymentMethod | null,
    action: string,
  ): Promise<InvoiceResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id: before.id },
        data: { status, paidOn, paymentMethod: method },
        include: INCLUDE,
      });
      const response = InvoiceResponseDto.from(updated);
      await this.audit.record(
        {
          action,
          entityType: ENTITY_TYPE,
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
