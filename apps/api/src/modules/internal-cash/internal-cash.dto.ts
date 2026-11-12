import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  Activity,
  CashDirection,
  InternalCashCategory,
  ReviewStatus,
  type InternalCashMovement,
} from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { IsCents, IsDateOnly } from '../../common/dto/validators';
import { dateOnly } from '../../common/utils/dates';
import { toNumber } from '../../common/utils/money';

export class CreateCashMovementDto {
  @IsDateOnly()
  occurred_on!: string;

  @ApiProperty({ enum: CashDirection })
  @IsEnum(CashDirection)
  direction!: CashDirection;

  @IsCents()
  @Min(1)
  amount_cents!: number;

  @ApiProperty({ enum: Activity })
  @IsEnum(Activity)
  activity!: Activity;

  @ApiProperty({ enum: InternalCashCategory })
  @IsEnum(InternalCashCategory)
  category!: InternalCashCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  concept!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @ApiPropertyOptional({ enum: ReviewStatus })
  @IsOptional()
  @IsEnum(ReviewStatus)
  review?: ReviewStatus;
}

export class UpdateCashMovementDto extends PartialType(CreateCashMovementDto) {}

export class CashQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateOnly()
  to?: string;

  @ApiPropertyOptional({ enum: Activity })
  @IsOptional()
  @IsEnum(Activity)
  activity?: Activity;
}

export class CashMovementResponseDto {
  id!: string;
  occurred_on!: string;
  @ApiProperty({ enum: CashDirection })
  direction!: CashDirection;
  amount_cents!: number;
  @ApiProperty({ enum: Activity })
  activity!: Activity;
  @ApiProperty({ enum: InternalCashCategory })
  category!: InternalCashCategory;
  concept!: string;
  notes!: string | null;
  @ApiProperty({ enum: ReviewStatus })
  review!: ReviewStatus;

  static from(row: InternalCashMovement): CashMovementResponseDto {
    return {
      id: row.id,
      occurred_on: dateOnly(row.occurredOn),
      direction: row.direction,
      amount_cents: toNumber(row.amountCents),
      activity: row.activity,
      category: row.category,
      concept: row.concept,
      notes: row.notes,
      review: row.review,
    };
  }
}

export class CashReportDto {
  movements!: CashMovementResponseDto[];
  in_cents!: number;
  out_cents!: number;
  /** Saldo acumulado desde el primer movimiento hasta `to` (no solo el del periodo). */
  balance_cents!: number;
  pending_review!: number;
}
