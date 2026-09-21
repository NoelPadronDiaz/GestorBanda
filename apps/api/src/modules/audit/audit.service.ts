import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestContextService } from '../../common/context/request-context.service';
import { paginationMeta, skipTake } from '../../common/dto/pagination.dto';
import { redact } from '../../common/utils/redact';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditLogResponseDto, ListAuditLogsQueryDto, PaginatedAuditLogsDto } from './audit.dto';

export interface AuditEntry {
  /** Código con puntos, p. ej. `members.updated`. */
  action: string;
  entityType: string;
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  /** Solo para eventos previos a la autenticación (login); por defecto se toma del contexto de la petición. */
  actorUserId?: string | null;
}

function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === undefined || value === null
    ? Prisma.DbNull
    : (redact(value) as Prisma.InputJsonValue);
}

/** Servicio transversal. Los demás módulos solo escriben (record); nadie modifica ni borra entradas. */
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  /** Pasa `tx` para que la entrada de auditoría se confirme o se revierta junto con el cambio auditado. */
  async record(entry: AuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    const ctx = this.requestContext.get();
    await client.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId:
          entry.entityId === undefined || entry.entityId === null ? null : String(entry.entityId),
        before: toJson(entry.before),
        after: toJson(entry.after),
        metadata: toJson(entry.metadata),
        actorUserId: entry.actorUserId ?? ctx?.userId ?? null,
        ipAddress: ctx?.ipAddress ?? null,
        userAgent: ctx?.userAgent ?? null,
        traceId: ctx?.traceId ?? null,
      },
    });
  }

  async list(query: ListAuditLogsQueryDto): Promise<PaginatedAuditLogsDto> {
    const where: Prisma.AuditLogWhereInput = {
      entityType: query.entity_type,
      entityId: query.entity_id,
      actorUserId: query.actor_user_id,
      action: query.action,
      occurredAt: { gte: query.from, lte: query.to },
    };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        ...skipTake(query),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      data: rows.map((row) => AuditLogResponseDto.from(row)),
      meta: paginationMeta(query, total),
    };
  }
}
