import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  Activity,
  RecurrenceFrequency,
  RecurringPartyType,
  type RecurringExpense,
  type Supplier,
  type Worker,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsCents, IsDateOnly } from '../../common/dto/validators';
import { dateOnly } from '../../common/utils/dates';
import { toNumber } from '../../common/utils/money';

export class CreateRecurringExpenseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  concept!: string;

  @ApiProperty({ enum: RecurringPartyType })
  @IsEnum(RecurringPartyType)
  party_type!: RecurringPartyType;

  @ApiPropertyOptional({ nullable: true, description: 'Solo si party_type = SUPPLIER' })
  @IsOptional()
  @IsUUID()
  supplier_id?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Obligatorio si party_type = WORKER' })
  @IsOptional()
  @IsUUID()
  worker_id?: string | null;

  @ApiProperty({ enum: Activity })
  @IsEnum(Activity)
  activity!: Activity;

  /** Importe estimado (para trabajadores, el neto previsto). */
  @IsCents()
  amount_cents!: number;

  @ApiProperty({ enum: RecurrenceFrequency })
  @IsEnum(RecurrenceFrequency)
  frequency!: RecurrenceFrequency;

  @IsDateOnly()
  next_due_on!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateRecurringExpenseDto extends PartialType(CreateRecurringExpenseDto) {}

export class RecurringExpenseResponseDto {
  id!: string;
  concept!: string;
  @ApiProperty({ enum: RecurringPartyType })
  party_type!: RecurringPartyType;
  supplier_id!: string | null;
  worker_id!: string | null;
  party_name!: string | null;
  @ApiProperty({ enum: Activity })
  activity!: Activity;
  amount_cents!: number;
  @ApiProperty({ enum: RecurrenceFrequency })
  frequency!: RecurrenceFrequency;
  next_due_on!: string;
  active!: boolean;

  static from(
    row: RecurringExpense & { supplier: Supplier | null; worker: Worker | null },
  ): RecurringExpenseResponseDto {
    return {
      id: row.id,
      concept: row.concept,
      party_type: row.partyType,
      supplier_id: row.supplierId,
      worker_id: row.workerId,
      party_name: row.supplier?.name ?? row.worker?.fullName ?? null,
      activity: row.activity,
      amount_cents: toNumber(row.amountCents),
      frequency: row.frequency,
      next_due_on: dateOnly(row.nextDueOn),
      active: row.active,
    };
  }
}
