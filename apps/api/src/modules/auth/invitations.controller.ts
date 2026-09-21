import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { RequirePermissions } from './decorators/require-permissions.decorator';
import { CreateInvitationDto, InvitationCreatedResponseDto } from './invitations.dto';
import { InvitationsService } from './invitations.service';

@ApiTags('invitations')
@ApiBearerAuth()
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  @RequirePermissions('users.invite')
  create(
    @Body() dto: CreateInvitationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<InvitationCreatedResponseDto> {
    return this.invitations.create(dto, actor);
  }
}
