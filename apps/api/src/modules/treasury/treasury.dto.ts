import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { BankMovement } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IsCents, IsDateOnly, IsYear } from '../../common/dto/validators';
import { dateOnly } from '../../common/utils/dates';
import { toNumber } from '../../common/utils/money';

export class BankRowDto {
  @IsDateOnly()
  booked_on!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ description: 'Con signo: positivo abono, negativo cargo' })
  @IsCents({ allowNegative: true })
  amount_cents!: number;
}

/** El CSV se interpreta en el navegador (columnas variables según el banco); aquí llegan filas limpias. */
export class ImportBankMovementsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  account_label!: string;

  @ApiProperty({ type: [BankRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => BankRowDto)
  rows!: BankRowDto[];
}

export class ImportResultDto {
  imported!: number;
  duplicates!: number;
}

export class ListBankMovementsQueryDto {
  @Type(() => Number)
  @IsYear()
  year!: number;

  @ApiPropertyOptional({ enum: ['pending', 'reconciled'] })
  @IsOptional()
  @IsIn(['pending', 'reconciled'])
  status?: 'pending' | 'reconciled';
}

export class ReconcileDto {
  @IsUUID()
  journal_entry_id!: string;
}

export class BankMovementResponseDto {
  id!: string;
  account_label!: string;
  booked_on!: string;
  description!: string;
  amount_cents!: number;
  journal_entry_id!: string | null;
  journal_entry_number!: string | null;
  reconciled_at!: string | null;

  static from(
    row: BankMovement & { journalEntry: { year: number; sequence: number } | null },
  ): BankMovementResponseDto {
    return {
      id: row.id,
      account_label: row.accountLabel,
      booked_on: dateOnly(row.bookedOn),
      description: row.description,
      amount_cents: toNumber(row.amountCents),
      journal_entry_id: row.journalEntryId,
      journal_entry_number: row.journalEntry
        ? `${row.journalEntry.year}/${row.journalEntry.sequence}`
        : null,
      reconciled_at: row.reconciledAt?.toISOString() ?? null,
    };
  }
}

export class CandidateDto {
  journal_entry_id!: string;
  entry_number!: string;
  entry_date!: string;
  reference!: string;
  concept!: string;
  amount_cents!: number;
  /** Días entre el apunte del banco y el asiento. */
  days_apart!: number;
}

export class TreasurySummaryDto {
  year!: number;
  movements!: number;
  pending!: number;
  /** Saldo contable a 31/12 (o a hoy si es el ejercicio en curso). */
  bank_ledger_cents!: number;
  cash_ledger_cents!: number;
  bank_lines_in_year!: number;
  bank_lines_reconciled!: number;
}
