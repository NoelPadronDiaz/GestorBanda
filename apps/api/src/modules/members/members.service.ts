import { HttpStatus, Injectable } from '@nestjs/common';
import type { Member, Prisma } from '@prisma/client';
import { paginationMeta, skipTake } from '../../common/dto/pagination.dto';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  type CreateMemberDto,
  type ListMembersQueryDto,
  MemberResponseDto,
  type PaginatedMembersDto,
  type UpdateMemberDto,
} from './members.dto';

const ENTITY_TYPE = 'MEMBER';

const toDate = (value: string | null | undefined): Date | null | undefined =>
  value === undefined || value === null ? value : new Date(value);

/** Propietario de la tabla member. Otros módulos usan solo los métodos públicos de este servicio. */
@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListMembersQueryDto): Promise<PaginatedMembersDto> {
    const search = query.q?.trim();
    const where: Prisma.MemberWhereInput = {
      deletedAt: null,
      status: query.status,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        ...skipTake(query),
      }),
      this.prisma.member.count({ where }),
    ]);
    return {
      data: rows.map((row) => MemberResponseDto.from(row)),
      meta: paginationMeta(query, total),
    };
  }

  async findOneOrFail(id: string): Promise<MemberResponseDto> {
    return MemberResponseDto.from(await this.findRowOrFail(id));
  }

  async assertExists(id: string): Promise<void> {
    await this.findRowOrFail(id);
  }

  async create(dto: CreateMemberDto): Promise<MemberResponseDto> {
    this.assertDateOrder(toDate(dto.joined_on), toDate(dto.left_on));
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.member.create({
        data: {
          firstName: dto.first_name,
          lastName: dto.last_name,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          birthDate: toDate(dto.birth_date) ?? null,
          status: dto.status,
          joinedOn: toDate(dto.joined_on) ?? null,
          leftOn: toDate(dto.left_on) ?? null,
          notes: dto.notes ?? null,
        },
      });
      const response = MemberResponseDto.from(created);
      await this.audit.record(
        {
          action: 'members.created',
          entityType: ENTITY_TYPE,
          entityId: created.id,
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  async update(id: string, dto: UpdateMemberDto): Promise<MemberResponseDto> {
    const before = await this.findRowOrFail(id);
    const joinedOn = dto.joined_on === undefined ? before.joinedOn : toDate(dto.joined_on);
    const leftOn = dto.left_on === undefined ? before.leftOn : toDate(dto.left_on);
    this.assertDateOrder(joinedOn, leftOn);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.member.update({
        where: { id },
        data: {
          // Columnas obligatorias: null se ignora (el DTO lo permite solo por ser PartialType).
          firstName: dto.first_name ?? undefined,
          lastName: dto.last_name ?? undefined,
          email: dto.email,
          phone: dto.phone,
          birthDate: toDate(dto.birth_date),
          status: dto.status ?? undefined,
          joinedOn: toDate(dto.joined_on),
          leftOn: toDate(dto.left_on),
          notes: dto.notes,
        },
      });
      const response = MemberResponseDto.from(updated);
      await this.audit.record(
        {
          action: 'members.updated',
          entityType: ENTITY_TYPE,
          entityId: id,
          before: MemberResponseDto.from(before),
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  /** Borrado lógico: el registro se conserva por trazabilidad y para documentos ya asociados. */
  async remove(id: string): Promise<void> {
    const before = await this.findRowOrFail(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.member.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(
        {
          action: 'members.deleted',
          entityType: ENTITY_TYPE,
          entityId: id,
          before: MemberResponseDto.from(before),
        },
        tx,
      );
    });
  }

  private async findRowOrFail(id: string): Promise<Member> {
    const member = await this.prisma.member.findFirst({ where: { id, deletedAt: null } });
    if (!member) throw new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Member not found');
    return member;
  }

  private assertDateOrder(joinedOn?: Date | null, leftOn?: Date | null): void {
    if (joinedOn && leftOn && leftOn < joinedOn) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Request validation failed',
        [{ field: 'left_on', messages: ['left_on must not be earlier than joined_on'] }],
      );
    }
  }
}
