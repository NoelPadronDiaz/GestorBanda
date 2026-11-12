import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Activity, GrantStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsCents, IsDateOnly, IsYear } from '../../common/dto/validators';
import type { ExpenseResponseDto } from '../billing/expenses.dto';

export class CreateGrantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  issuer!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title!: string;

  @IsYear()
  year!: number;

  @ApiProperty({ enum: Activity })
  @IsEnum(Activity)
  activity!: Activity;

  @IsCents()
  awarded_cents!: number;

  @IsOptional()
  @IsCents({ required: false })
  received_cents?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateOnly()
  justification_deadline?: string | null;

  @ApiPropertyOptional({ enum: GrantStatus })
  @IsOptional()
  @IsEnum(GrantStatus)
  status?: GrantStatus;

  @ApiPropertyOptional({ nullable: true, description: 'Expediente o referencia' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateGrantDto extends PartialType(CreateGrantDto) {}

export class GrantQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsYear()
  year?: number;
}

export class LinkExpenseDto {
  @IsUUID()
  expense_id!: string;
}

export class GrantResponseDto {
  id!: string;
  issuer!: string;
  title!: string;
  year!: number;
  @ApiProperty({ enum: Activity })
  activity!: Activity;
  awarded_cents!: number;
  received_cents!: number;
  justification_deadline!: string | null;
  @ApiProperty({ enum: GrantStatus })
  status!: GrantStatus;
  reference!: string | null;
  notes!: string | null;
  /** Suma de los totales de los gastos imputados. */
  justified_cents!: number;
  expenses!: ExpenseResponseDto[];
}
