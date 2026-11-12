import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Activity,
  FiscalYearStatus,
  JournalSourceType,
  type JournalEntry,
  type JournalLine,
  type LedgerAccount,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PaginatedMetaHolder } from '../../common/dto/paginated.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { IsCents, IsDateOnly, IsYear } from '../../common/dto/validators';
import { dateOnly } from '../../common/utils/dates';
import { toNumber } from '../../common/utils/money';

const ACCOUNT_CODE = /^[0-9]{3,10}$/;

/** Orígenes que puede indicar quien contabiliza; el resto los crea el sistema (reversión, cierre). */
export const POSTABLE_SOURCES = [
  'MANUAL',
  'OPENING',
  'INVOICE',
  'INVOICE_PAYMENT',
  'EXPENSE',
  'EXPENSE_PAYMENT',
  'PAYROLL',
  'PAYROLL_PAYMENT',
] as const satisfies readonly JournalSourceType[];
export type PostableSource = (typeof POSTABLE_SOURCES)[number];

export class CreateAccountDto {
  @ApiProperty({ example: '6290' })
  @Matches(ACCOUNT_CODE)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;
}

export class AccountResponseDto {
  code!: string;
  name!: string;

  static from(row: LedgerAccount): AccountResponseDto {
    return { code: row.code, name: row.name };
  }
}

export class JournalLineDto {
  @ApiProperty({ example: '572' })
  @Matches(ACCOUNT_CODE)
  account_code!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description!: string | null;

  @IsCents()
  debit_cents!: number;

  @IsCents()
  credit_cents!: number;
}

export class PostEntryDto {
  @IsDateOnly()
  entry_date!: string;

  @ApiProperty({ enum: Activity })
  @IsEnum(Activity)
  activity!: Activity;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  reference!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  concept!: string;

  @ApiProperty({ enum: POSTABLE_SOURCES })
  @IsIn(POSTABLE_SOURCES)
  source_type!: PostableSource;

  @ApiPropertyOptional({ description: 'Documento de origen (no para MANUAL ni OPENING)' })
  @IsOptional()
  @IsUUID()
  source_id?: string;

  @ApiProperty({ type: [JournalLineDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}

export class ProposalQueryDto {
  @ApiProperty({
    enum: [
      'INVOICE',
      'INVOICE_PAYMENT',
      'EXPENSE',
      'EXPENSE_PAYMENT',
      'PAYROLL',
      'PAYROLL_PAYMENT',
    ],
  })
  @IsIn(['INVOICE', 'INVOICE_PAYMENT', 'EXPENSE', 'EXPENSE_PAYMENT', 'PAYROLL', 'PAYROLL_PAYMENT'])
  source_type!: Exclude<PostableSource, 'MANUAL' | 'OPENING'>;

  @IsUUID()
  source_id!: string;

  @ApiPropertyOptional({ description: 'Solo gastos: el IGIC soportado es deducible' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  igic_deductible?: boolean;

  @ApiPropertyOptional({ description: 'Cobros/pagos: CASH (570) o BANK (572)', default: 'BANK' })
  @IsOptional()
  @IsIn(['BANK', 'CASH'])
  via?: 'BANK' | 'CASH';

  @ApiPropertyOptional({
    description: 'Cobros/pagos: fecha efectiva; por defecto la registrada o hoy',
  })
  @IsOptional()
  @IsDateOnly()
  date?: string;
}

export class ProposalResponseDto {
  @ApiProperty({ enum: JournalSourceType })
  source_type!: JournalSourceType;
  source_id!: string;
  entry_date!: string;
  @ApiProperty({ enum: Activity })
  activity!: Activity;
  reference!: string;
  concept!: string;
  lines!: JournalLineDto[];
  /** Avisos para revisar antes de contabilizar (códigos estables). */
  warnings!: string[];
}

export class ListEntriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsYear()
  year?: number;

  @ApiPropertyOptional({ enum: Activity })
  @IsOptional()
  @IsEnum(Activity)
  activity?: Activity;

  @ApiPropertyOptional({ enum: JournalSourceType })
  @IsOptional()
  @IsEnum(JournalSourceType)
  source_type?: JournalSourceType;

  @ApiPropertyOptional({ description: 'Solo asientos que tocan esta cuenta (prefijo)' })
  @IsOptional()
  @Matches(/^[0-9]{1,10}$/)
  account?: string;
}

export class EntryLineResponseDto {
  position!: number;
  account_code!: string;
  account_name!: string;
  description!: string | null;
  debit_cents!: number;
  credit_cents!: number;
}

export class EntryResponseDto {
  id!: string;
  year!: number;
  sequence!: number;
  /** 2026/14 */
  number!: string;
  entry_date!: string;
  @ApiProperty({ enum: Activity })
  activity!: Activity;
  reference!: string;
  concept!: string;
  @ApiProperty({ enum: JournalSourceType })
  source_type!: JournalSourceType;
  source_id!: string | null;
  reversal_of_id!: string | null;
  reversed_by_id!: string | null;
  total_cents!: number;
  lines!: EntryLineResponseDto[];
  created_at!: string;

  static from(
    row: JournalEntry & {
      lines: (JournalLine & { account: LedgerAccount })[];
      reversedBy: { id: string } | null;
    },
  ): EntryResponseDto {
    const lines = [...row.lines].sort((a, b) => a.position - b.position);
    return {
      id: row.id,
      year: row.year,
      sequence: row.sequence,
      number: `${row.year}/${row.sequence}`,
      entry_date: dateOnly(row.entryDate),
      activity: row.activity,
      reference: row.reference,
      concept: row.concept,
      source_type: row.sourceType,
      source_id: row.sourceId,
      reversal_of_id: row.reversalOfId,
      reversed_by_id: row.reversedBy?.id ?? null,
      total_cents: lines.reduce((sum, line) => sum + toNumber(line.debitCents), 0),
      lines: lines.map((line) => ({
        position: line.position,
        account_code: line.accountCode,
        account_name: line.account.name,
        description: line.description,
        debit_cents: toNumber(line.debitCents),
        credit_cents: toNumber(line.creditCents),
      })),
      created_at: row.createdAt.toISOString(),
    };
  }
}

export class PaginatedEntriesDto extends PaginatedMetaHolder {
  @ApiProperty({ type: [EntryResponseDto] })
  data!: EntryResponseDto[];
}

export class ReportQueryDto {
  @Type(() => Number)
  @IsYear()
  year!: number;

  @ApiPropertyOptional({ enum: Activity })
  @IsOptional()
  @IsEnum(Activity)
  activity?: Activity;
}

export class LedgerQueryDto {
  @Type(() => Number)
  @IsYear()
  year!: number;

  @ApiProperty({ example: '572' })
  @Matches(ACCOUNT_CODE)
  account!: string;
}

export class LedgerMovementDto {
  entry_id!: string;
  entry_number!: string;
  entry_date!: string;
  reference!: string;
  concept!: string;
  description!: string | null;
  debit_cents!: number;
  credit_cents!: number;
  /** Saldo acumulado (deudor positivo) incluyendo el saldo inicial. */
  balance_cents!: number;
}

export class LedgerResponseDto {
  account_code!: string;
  account_name!: string;
  /** Saldo al inicio del ejercicio (asientos anteriores). */
  opening_balance_cents!: number;
  movements!: LedgerMovementDto[];
  closing_balance_cents!: number;
}

export class TrialBalanceRowDto {
  account_code!: string;
  account_name!: string;
  debit_cents!: number;
  credit_cents!: number;
  /** Positivo = saldo deudor; negativo = acreedor. */
  balance_cents!: number;
}

export class ReportLineDto {
  account_code!: string;
  account_name!: string;
  amount_cents!: number;
}

export class IncomeStatementDto {
  year!: number;
  activity!: Activity | null;
  income!: ReportLineDto[];
  expenses!: ReportLineDto[];
  income_total_cents!: number;
  expenses_total_cents!: number;
  result_cents!: number;
}

export class BalanceSheetDto {
  year!: number;
  assets!: ReportLineDto[];
  liabilities!: ReportLineDto[];
  equity!: ReportLineDto[];
  /** Resultado de las cuentas 6/7 aún no regularizado (forma parte del patrimonio neto). */
  pending_result_cents!: number;
  assets_total_cents!: number;
  liabilities_total_cents!: number;
  equity_total_cents!: number;
  /** Activo − (pasivo + patrimonio neto): debe ser 0. */
  difference_cents!: number;
  warnings!: string[];
}

export class FiscalYearResponseDto {
  year!: number;
  @ApiProperty({ enum: FiscalYearStatus })
  status!: FiscalYearStatus;
  closed_at!: string | null;
  entry_count!: number;
}

export class ClosePreviewDto {
  year!: number;
  @ApiProperty({ enum: FiscalYearStatus })
  status!: FiscalYearStatus;
  ordinary_entry_count!: number;
  surplus_cents!: number;
  regularization!: JournalLineDto[];
  closing!: JournalLineDto[];
  /** Impiden cerrar: YEAR_CLOSED, NO_ENTRIES, NEXT_YEAR_HAS_ENTRIES, PATRIMONY_UNBALANCED. */
  blockers!: string[];
  /** Informativos: NO_OPENING_BALANCES. */
  warnings!: string[];
}

export class PendingQueryDto {
  @Type(() => Number)
  @IsYear()
  year!: number;
}

/** Documento con un asiento pendiente (devengo o cobro/pago) para la cola de contabilización. */
export class PendingDocumentDto {
  @ApiProperty({ enum: POSTABLE_SOURCES })
  source_type!: (typeof POSTABLE_SOURCES)[number];
  source_id!: string;
  date!: string;
  label!: string;
  @ApiProperty({ enum: Activity })
  activity!: Activity;
  amount_cents!: number;
  has_input_tax!: boolean;
}
