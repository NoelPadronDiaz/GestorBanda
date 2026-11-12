import { Injectable } from '@nestjs/common';
import type { Supplier } from '@prisma/client';
import { conflict, notFound } from '../../common/errors/domain-errors';
import { percentToBp } from '../../common/utils/money';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  type CreateSupplierDto,
  SupplierResponseDto,
  type UpdateSupplierDto,
} from './suppliers.dto';

const ENTITY_TYPE = 'SUPPLIER';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Una asociación tiene decenas de proveedores, no miles: se devuelven todos ordenados. */
  async list(): Promise<SupplierResponseDto[]> {
    const rows = await this.prisma.supplier.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => SupplierResponseDto.from(row));
  }

  async findRowOrFail(id: string): Promise<Supplier> {
    const row = await this.prisma.supplier.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw notFound('Supplier');
    return row;
  }

  async create(dto: CreateSupplierDto): Promise<SupplierResponseDto> {
    await this.assertTaxIdFree(dto.tax_id);
    const kind = dto.kind ?? 'COMPANY';
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({
        data: {
          name: dto.name.trim(),
          taxId: dto.tax_id?.trim() || null,
          kind,
          defaultWithholdingBp: percentToBp(
            dto.default_withholding_rate ?? (kind === 'PROFESSIONAL' ? 15 : 0),
          ),
          addressLine: dto.address_line ?? null,
          city: dto.city ?? null,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
        },
      });
      const response = SupplierResponseDto.from(created);
      await this.audit.record(
        {
          action: 'suppliers.created',
          entityType: ENTITY_TYPE,
          entityId: created.id,
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  async update(id: string, dto: UpdateSupplierDto): Promise<SupplierResponseDto> {
    const before = await this.findRowOrFail(id);
    if (dto.tax_id !== undefined) await this.assertTaxIdFree(dto.tax_id, id);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.supplier.update({
        where: { id },
        data: {
          name: dto.name?.trim() ?? undefined,
          taxId: dto.tax_id === undefined ? undefined : dto.tax_id?.trim() || null,
          kind: dto.kind ?? undefined,
          defaultWithholdingBp:
            dto.default_withholding_rate === undefined
              ? undefined
              : percentToBp(dto.default_withholding_rate),
          addressLine: dto.address_line,
          city: dto.city,
          email: dto.email,
          phone: dto.phone,
        },
      });
      const response = SupplierResponseDto.from(updated);
      await this.audit.record(
        {
          action: 'suppliers.updated',
          entityType: ENTITY_TYPE,
          entityId: id,
          before: SupplierResponseDto.from(before),
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  async remove(id: string): Promise<void> {
    const before = await this.findRowOrFail(id);
    const [expenses, recurring] = await Promise.all([
      this.prisma.expense.count({ where: { supplierId: id } }),
      this.prisma.recurringExpense.count({ where: { supplierId: id } }),
    ]);
    if (expenses || recurring) {
      throw conflict('SUPPLIER_IN_USE', 'Supplier has expenses or recurring templates');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(
        {
          action: 'suppliers.deleted',
          entityType: ENTITY_TYPE,
          entityId: id,
          before: SupplierResponseDto.from(before),
        },
        tx,
      );
    });
  }

  private async assertTaxIdFree(
    taxId: string | null | undefined,
    exceptId?: string,
  ): Promise<void> {
    const value = taxId?.trim();
    if (!value) return;
    const existing = await this.prisma.supplier.findFirst({
      where: {
        deletedAt: null,
        taxId: { equals: value, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    if (existing) throw conflict('SUPPLIER_TAX_ID_TAKEN', 'Another supplier has this tax id');
  }
}
