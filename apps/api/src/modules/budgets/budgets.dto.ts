import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Activity, BudgetKind } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { IsCents, IsYear } from '../../common/dto/validators';

export class CreateBudgetLineDto {
  @IsYear()
  year!: number;

  @ApiProperty({ enum: Activity })
  @IsEnum(Activity)
  activity!: Activity;

  @ApiProperty({ enum: BudgetKind })
  @IsEnum(BudgetKind)
  kind!: BudgetKind;

  @ApiProperty({
    example: '705',
    description: 'Prefijo de cuenta del grupo 6 (gasto) o 7 (ingreso)',
  })
  @Matches(/^[67][0-9]{0,9}$/)
  account_prefix!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;

  @IsCents()
  amount_cents!: number;
}

export class UpdateBudgetLineDto extends PartialType(CreateBudgetLineDto) {}

export class BudgetQueryDto {
  @Type(() => Number)
  @IsYear()
  year!: number;

  @ApiPropertyOptional({ enum: Activity })
  @IsOptional()
  @IsEnum(Activity)
  activity?: Activity;
}

export class BudgetLineResponseDto {
  id!: string;
  year!: number;
  @ApiProperty({ enum: Activity })
  activity!: Activity;
  @ApiProperty({ enum: BudgetKind })
  kind!: BudgetKind;
  account_prefix!: string;
  label!: string;
  amount_cents!: number;
  /** Importe real contabilizado (sin regularización ni cierre). */
  actual_cents!: number;
  /** Real − previsto. */
  deviation_cents!: number;
}

export class BudgetReportDto {
  lines!: BudgetLineResponseDto[];
  income_budget_cents!: number;
  income_actual_cents!: number;
  expense_budget_cents!: number;
  expense_actual_cents!: number;
}
