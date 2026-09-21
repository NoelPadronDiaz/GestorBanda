import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AuditLog } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginatedMetaHolder } from '../../common/dto/paginated.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ListAuditLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'MEMBER' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entity_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entity_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actor_user_id?: string;

  @ApiPropertyOptional({ example: 'members.updated' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

export class AuditLogResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, format: 'date-time' }) occurred_at!: string;
  @ApiProperty({ nullable: true, type: String }) actor_user_id!: string | null;
  @ApiProperty() action!: string;
  @ApiProperty() entity_type!: string;
  @ApiProperty({ nullable: true, type: String }) entity_id!: string | null;
  @ApiProperty({ nullable: true, type: Object }) before!: unknown;
  @ApiProperty({ nullable: true, type: Object }) after!: unknown;
  @ApiProperty({ nullable: true, type: Object }) metadata!: unknown;
  @ApiProperty({ nullable: true, type: String }) ip_address!: string | null;
  @ApiProperty({ nullable: true, type: String }) trace_id!: string | null;

  static from(row: AuditLog): AuditLogResponseDto {
    return {
      id: row.id,
      occurred_at: row.occurredAt.toISOString(),
      actor_user_id: row.actorUserId,
      action: row.action,
      entity_type: row.entityType,
      entity_id: row.entityId,
      before: row.before,
      after: row.after,
      metadata: row.metadata,
      ip_address: row.ipAddress,
      trace_id: row.traceId,
    };
  }
}

export class PaginatedAuditLogsDto extends PaginatedMetaHolder {
  @ApiProperty({ type: [AuditLogResponseDto] }) data!: AuditLogResponseDto[];
}
