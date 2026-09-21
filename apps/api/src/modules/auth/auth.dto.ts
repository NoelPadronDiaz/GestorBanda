import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail } from '../../common/decorators/normalize-email.decorator';
import type { AuthenticatedUser } from './auth.types';

export class LoginDto {
  @ApiProperty({ example: 'admin@banda.example' })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class MeResponseDto {
  id!: string;
  email!: string;
  member_id!: string | null;
  roles!: string[];
  permissions!: string[];
  last_login_at!: string | null;

  static from(user: AuthenticatedUser): MeResponseDto {
    return {
      id: user.id,
      email: user.email,
      member_id: user.memberId,
      roles: user.roles,
      permissions: user.permissions,
      last_login_at: user.lastLoginAt?.toISOString() ?? null,
    };
  }
}

/** Respuesta de login y refresh. El refresh token viaja solo en cookie httpOnly, nunca en el cuerpo. */
export class SessionResponseDto {
  access_token!: string;
  @ApiProperty({ enum: ['Bearer'] })
  token_type!: 'Bearer';
  @ApiProperty({ description: 'Segundos de vida del access token' })
  expires_in!: number;
  user!: MeResponseDto;
}
