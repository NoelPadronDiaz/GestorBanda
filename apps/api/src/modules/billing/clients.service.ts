import { Injectable } from '@nestjs/common';
import type { Client, Prisma } from '@prisma/client';
import { paginationMeta, skipTake } from '../../common/dto/pagination.dto';
import { conflict, notFound } from '../../common/errors/domain-errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ClientResponseDto,
  type CreateClientDto,
  type ListClientsQueryDto,
  type PaginatedClientsDto,
  type UpdateClientDto,
} from './clients.dto';

const ENTITY_TYPE = 'CLIENT';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListClientsQueryDto): Promise<PaginatedClientsDto> {
    const search = query.q?.trim();
    const where: Prisma.ClientWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { taxId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.client.findMany({ where, orderBy: { name: 'asc' }, ...skipTake(query) }),
      this.prisma.client.count({ where }),
    ]);
    return {
      data: rows.map((row) => ClientResponseDto.from(row)),
      meta: paginationMeta(query, total),
    };
  }

  async findOneOrFail(id: string): Promise<ClientResponseDto> {
    return ClientResponseDto.from(await this.findRowOrFail(id));
  }

  async findRowOrFail(id: string): Promise<Client> {
    const row = await this.prisma.client.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw notFound('Client');
    return row;
  }

  async create(dto: CreateClientDto): Promise<ClientResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.client.create({
        data: {
          name: dto.name.trim(),
          taxId: dto.tax_id?.trim() || null,
          addressLine: dto.address_line ?? null,
          city: dto.city ?? null,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          notes: dto.notes ?? null,
        },
      });
      const response = ClientResponseDto.from(created);
      await this.audit.record(
        {
          action: 'clients.created',
          entityType: ENTITY_TYPE,
          entityId: created.id,
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  async update(id: string, dto: UpdateClientDto): Promise<ClientResponseDto> {
    const before = await this.findRowOrFail(id);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.client.update({
        where: { id },
        data: {
          name: dto.name?.trim() ?? undefined,
          taxId: dto.tax_id === undefined ? undefined : dto.tax_id?.trim() || null,
          addressLine: dto.address_line,
          city: dto.city,
          email: dto.email,
          phone: dto.phone,
          notes: dto.notes,
        },
      });
      const response = ClientResponseDto.from(updated);
      await this.audit.record(
        {
          action: 'clients.updated',
          entityType: ENTITY_TYPE,
          entityId: id,
          before: ClientResponseDto.from(before),
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  /** Borrado lógico; un cliente con facturas no se puede borrar (las facturas lo referencian). */
  async remove(id: string): Promise<void> {
    const before = await this.findRowOrFail(id);
    if (await this.prisma.invoice.count({ where: { clientId: id } })) {
      throw conflict('CLIENT_HAS_INVOICES', 'Client has invoices and cannot be deleted');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.client.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(
        {
          action: 'clients.deleted',
          entityType: ENTITY_TYPE,
          entityId: id,
          before: ClientResponseDto.from(before),
        },
        tx,
      );
    });
  }
}
