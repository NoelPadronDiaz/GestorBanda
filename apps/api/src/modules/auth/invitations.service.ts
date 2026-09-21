import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { normalizeEmail } from '../../common/utils/email';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MembersService } from '../members/members.service';
import type { AuthenticatedUser } from './auth.types';
import {
  type AcceptInvitationDto,
  type AcceptInvitationResponseDto,
  type CreateInvitationDto,
  type InvitationCreatedResponseDto,
} from './invitations.dto';
import { PasswordService } from './password.service';
import { generateOpaqueToken, hashToken } from './token.service';
import { UsersService } from './users.service';

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_INVITATION_TTL_HOURS = 72;

const invalidInvitation = () =>
  new AppException(
    HttpStatus.BAD_REQUEST,
    'INVALID_INVITATION',
    'Invitation is invalid or has expired',
  );

/** Propietario de la tabla invitation. */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly members: MembersService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateInvitationDto,
    actor: AuthenticatedUser,
  ): Promise<InvitationCreatedResponseDto> {
    // Evita escalada de privilegios: solo un ADMIN puede crear otro ADMIN.
    if (dto.role_code === 'ADMIN' && !actor.roles.includes('ADMIN')) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'FORBIDDEN',
        'Only administrators can invite administrators',
      );
    }

    const email = normalizeEmail(dto.email);
    if (await this.users.emailInUse(email)) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'A user with this email already exists',
      );
    }
    const role = await this.users.findRoleByCode(dto.role_code);
    if (!role) throw new AppException(HttpStatus.BAD_REQUEST, 'BAD_REQUEST', 'Unknown role');
    if (dto.member_id) await this.members.assertExists(dto.member_id);

    const token = generateOpaqueToken();
    const expiresAt = new Date(
      Date.now() + (dto.expires_in_hours ?? DEFAULT_INVITATION_TTL_HOURS) * HOUR_MS,
    );

    const invitation = await this.prisma.$transaction(async (tx) => {
      // Reinvitar al mismo email invalida las invitaciones pendientes anteriores.
      await tx.invitation.updateMany({
        where: { email, status: 'PENDING' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      const created = await tx.invitation.create({
        data: {
          email,
          roleId: role.id,
          memberId: dto.member_id ?? null,
          tokenHash: hashToken(token),
          expiresAt,
          invitedById: actor.id,
        },
      });
      await this.audit.record(
        {
          action: 'invitations.created',
          entityType: 'INVITATION',
          entityId: created.id,
          after: {
            email,
            role_code: role.code,
            member_id: created.memberId,
            expires_at: expiresAt.toISOString(),
          },
        },
        tx,
      );
      return created;
    });

    return {
      id: invitation.id,
      email,
      role_code: role.code,
      member_id: invitation.memberId,
      expires_at: expiresAt.toISOString(),
      token,
    };
  }

  async accept(dto: AcceptInvitationDto): Promise<AcceptInvitationResponseDto> {
    const now = new Date();
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(dto.token) },
      include: { role: true },
    });
    if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt <= now) {
      throw invalidInvitation();
    }
    if (await this.users.emailInUse(invitation.email)) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'A user with this email already exists',
      );
    }

    const passwordHash = await this.passwords.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.invitation.updateMany({
        where: { id: invitation.id, status: 'PENDING' },
        data: { status: 'ACCEPTED', acceptedAt: now },
      });
      if (claimed.count !== 1) throw invalidInvitation();

      const created = await tx.userAccount.create({
        data: {
          email: invitation.email,
          passwordHash,
          memberId: invitation.memberId,
          roles: { create: { roleId: invitation.roleId, assignedById: invitation.invitedById } },
        },
      });
      await this.audit.record(
        {
          action: 'users.created',
          entityType: 'USER_ACCOUNT',
          entityId: created.id,
          actorUserId: created.id,
          after: {
            email: created.email,
            role_code: invitation.role.code,
            member_id: created.memberId,
          },
          metadata: { invitation_id: invitation.id },
        },
        tx,
      );
      await this.audit.record(
        {
          action: 'invitations.accepted',
          entityType: 'INVITATION',
          entityId: invitation.id,
          actorUserId: created.id,
        },
        tx,
      );
      return created;
    });

    return { user_id: user.id, email: user.email };
  }
}
