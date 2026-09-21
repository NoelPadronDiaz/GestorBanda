import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ROLE_CODES, type RoleCode } from '@alcaravan/shared';
import { NormalizeEmail } from '../../common/decorators/normalize-email.decorator';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateInvitationDto {
  @ApiProperty({ example: 'nuevo.miembro@example.com' })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ enum: ROLE_CODES })
  @IsIn(ROLE_CODES)
  role_code!: RoleCode;

  @ApiPropertyOptional({ description: 'Miembro existente al que se vinculará la cuenta' })
  @IsOptional()
  @IsUUID()
  member_id?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 168, default: 72 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  expires_in_hours?: number;
}

export class InvitationCreatedResponseDto {
  id!: string;
  email!: string;
  role_code!: string;
  member_id!: string | null;
  expires_at!: string;
  @ApiProperty({
    description:
      'Token de un solo uso. Solo se devuelve aquí; en BD queda únicamente su hash. ' +
      'Cuando exista el módulo de notificaciones se enviará por email en lugar de devolverse.',
  })
  token!: string;
}

export class AcceptInvitationDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;

  @ApiProperty({ minLength: 12, description: 'Mínimo 12 caracteres' })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}

export class AcceptInvitationResponseDto {
  user_id!: string;
  email!: string;
}
