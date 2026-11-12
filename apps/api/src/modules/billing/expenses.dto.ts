import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  Activity,
  ExpenseCategory,
  ExpenseStatus,
  PaymentMethod,
  type Expense,
  type Supplier,
} from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginatedMetaHolder } from '../../common/dto/paginated.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { IsCents, IsDateOnly, IsPercent, IsYear } from '../../common/dto/validators';
import { dateOnly } from '../../common/utils/dates';
import { bpToPercent, toNumber } from '../../common/utils/money';

export class CreateExpenseDto {
  @IsUUID()
  supplier_id!: string;

  @ApiProperty({ description: 'Número de la factura del proveedor' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  number!: string;

  @IsDateOnly()
  issue_date!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateOnly()
  operation_date?: string | null;

  @ApiProperty({ enum: Activity })
  @IsEnum(Activity)
  activity!: Activity;

  @ApiPropertyOptional({ enum: ExpenseCategory })
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  concept!: string;

  @IsCents()
  base_cents!: number;

  @ApiProperty({ example: 7 })
  @IsPercent()
  tax_rate!: number;

  /** Cuota de IGIC según el documento; si se omite se calcula desde base y tipo. */
  @IsOptional()
  @IsCents({ required: false })
  tax_cents?: number;

  @IsOptional()
  @IsCents({ allowNegative: true, required: false })
  other_cents?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsPercent()
  withholding_rate?: number;

  /** Retención IRPF según el documento; si se omite se calcula desde base y tipo. */
  @IsOptional()
  @IsCents({ required: false })
  withholding_cents?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}

export class MarkExpensePaidDto {
  @IsDateOnly()
  paid_on!: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  payment_method!: PaymentMethod;
}

export class ListExpensesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsYear()
  year?: number;

  @ApiPropertyOptional({ enum: Activity })
  @IsOptional()
  @IsEnum(Activity)
  activity?: Activity;

  @ApiPropertyOptional({ enum: ExpenseStatus })
  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplier_id?: string;

  @ApiPropertyOptional({ description: 'Número, concepto o proveedor' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class ExpenseResponseDto {
  id!: string;
  supplier_id!: string;
  supplier_name!: string;
  supplier_tax_id!: string | null;
  number!: string;
  issue_date!: string;
  operation_date!: string | null;
  @ApiProperty({ enum: Activity })
  activity!: Activity;
  @ApiProperty({ enum: ExpenseCategory })
  category!: ExpenseCategory;
  concept!: string;
  base_cents!: number;
  tax_rate!: number;
  tax_cents!: number;
  other_cents!: number;
  withholding_rate!: number;
  withholding_cents!: number;
  total_cents!: number;
  @ApiProperty({ enum: ExpenseStatus })
  status!: ExpenseStatus;
  paid_on!: string | null;
  payment_method!: PaymentMethod | null;
  notes!: string | null;
  journal_entry_id!: string | null;
  payment_entry_id!: string | null;
  created_at!: string;
  updated_at!: string;

  static from(row: Expense & { supplier: Supplier }): ExpenseResponseDto {
    return {
      id: row.id,
      supplier_id: row.supplierId,
      supplier_name: row.supplier.name,
      supplier_tax_id: row.supplier.taxId,
      number: row.number,
      issue_date: dateOnly(row.issueDate),
      operation_date: dateOnly(row.operationDate),
      activity: row.activity,
      category: row.category,
      concept: row.concept,
      base_cents: toNumber(row.baseCents),
      tax_rate: bpToPercent(row.taxRateBp),
      tax_cents: toNumber(row.taxCents),
      other_cents: toNumber(row.otherCents),
      withholding_rate: bpToPercent(row.withholdingRateBp),
      withholding_cents: toNumber(row.withholdingCents),
      total_cents: toNumber(row.totalCents),
      status: row.status,
      paid_on: dateOnly(row.paidOn),
      payment_method: row.paymentMethod,
      notes: row.notes,
      journal_entry_id: row.journalEntryId,
      payment_entry_id: row.paymentEntryId,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }
}

export class PaginatedExpensesDto extends PaginatedMetaHolder {
  @ApiProperty({ type: [ExpenseResponseDto] })
  data!: ExpenseResponseDto[];
}

export class ExpenseTotalsDto {
  count!: number;
  total_cents!: number;
  pending_count!: number;
  pending_cents!: number;
}
