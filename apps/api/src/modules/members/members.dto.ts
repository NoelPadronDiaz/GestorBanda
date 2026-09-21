import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { MemberStatus, type Member } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginatedMetaHolder } from '../../common/dto/paginated.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreateMemberDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  first_name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  last_name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1990-05-17' })
  @IsOptional()
  @IsISO8601({ strict: true })
  birth_date?: string | null;

  @ApiPropertyOptional({ enum: MemberStatus, default: MemberStatus.ACTIVE })
  @IsOptional()
  @IsEnum(MemberStatus)
  status?: MemberStatus;

  @ApiPropertyOptional({ nullable: true, example: '2024-09-01' })
  @IsOptional()
  @IsISO8601({ strict: true })
  joined_on?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsISO8601({ strict: true })
  left_on?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Observaciones libres' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

export class UpdateMemberDto extends PartialType(CreateMemberDto) {}

export class ListMembersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Búsqueda por nombre, apellidos o email' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: MemberStatus })
  @IsOptional()
  @IsEnum(MemberStatus)
  status?: MemberStatus;
}

const dateOnly = (date: Date | null): string | null =>
  date ? date.toISOString().slice(0, 10) : null;

export class MemberResponseDto {
  id!: string;
  first_name!: string;
  last_name!: string;
  email!: string | null;
  phone!: string | null;
  birth_date!: string | null;
  @ApiProperty({ enum: MemberStatus })
  status!: MemberStatus;
  joined_on!: string | null;
  left_on!: string | null;
  notes!: string | null;
  created_at!: string;
  updated_at!: string;

  static from(member: Member): MemberResponseDto {
    return {
      id: member.id,
      first_name: member.firstName,
      last_name: member.lastName,
      email: member.email,
      phone: member.phone,
      birth_date: dateOnly(member.birthDate),
      status: member.status,
      joined_on: dateOnly(member.joinedOn),
      left_on: dateOnly(member.leftOn),
      notes: member.notes,
      created_at: member.createdAt.toISOString(),
      updated_at: member.updatedAt.toISOString(),
    };
  }
}

export class PaginatedMembersDto extends PaginatedMetaHolder {
  @ApiProperty({ type: [MemberResponseDto] })
  data!: MemberResponseDto[];
}
