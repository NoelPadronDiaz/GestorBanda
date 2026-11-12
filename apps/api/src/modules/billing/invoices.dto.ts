import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InvoiceSeries,
  InvoiceStatus,
  PaymentMethod,
  type Invoice,
  type InvoiceLine,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginatedMetaHolder } from '../../common/dto/paginated.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { IsDateOnly, IsPercent, IsYear } from '../../common/dto/validators';
import { dateOnly } from '../../common/utils/dates';
import { bpToPercent, toNumber } from '../../common/utils/money';

export class InvoiceLineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ example: 1 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @ApiProperty({ example: 1401.87, description: 'Euros sin IGIC, hasta 4 decimales' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unit_price!: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ enum: InvoiceSeries, description: 'ALC = Banda, ESC = Escuela' })
  @IsEnum(InvoiceSeries)
  series!: InvoiceSeries;

  @ApiProperty({ example: '2026-11-12' })
  @IsDateOnly()
  issue_date!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Fecha de la operación o actuación' })
  @IsOptional()
  @IsDateOnly()
  operation_date?: string | null;

  @IsUUID()
  client_id!: string;

  @ApiProperty({ example: 7, description: 'IGIC en %' })
  @IsPercent()
  tax_rate!: number;

  @ApiPropertyOptional({ example: 0, description: 'Retención en %, se resta del total' })
  @IsOptional()
  @IsPercent()
  withholding_rate?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiProperty({ type: [InvoiceLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];
}

/** La serie y el año (número) no cambian una vez emitida la factura. */
export class UpdateInvoiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateOnly()
  issue_date?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateOnly()
  operation_date?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  client_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsPercent()
  tax_rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsPercent()
  withholding_rate?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional({ type: [InvoiceLineDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines?: InvoiceLineDto[];
}

export class MarkPaidDto {
  @IsDateOnly()
  paid_on!: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  payment_method!: PaymentMethod;
}

export class ListInvoicesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsYear()
  year?: number;

  @ApiPropertyOptional({ enum: InvoiceSeries })
  @IsOptional()
  @IsEnum(InvoiceSeries)
  series?: InvoiceSeries;

  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ description: 'Número o destinatario' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class NextNumberQueryDto {
  @ApiProperty({ enum: InvoiceSeries })
  @IsEnum(InvoiceSeries)
  series!: InvoiceSeries;

  @ApiProperty()
  @Type(() => Number)
  @IsYear()
  year!: number;
}

export class InvoiceLineResponseDto {
  position!: number;
  description!: string;
  quantity!: number;
  unit_price!: number;
  amount_cents!: number;

  static from(line: InvoiceLine): InvoiceLineResponseDto {
    return {
      position: line.position,
      description: line.description,
      quantity: line.quantity.toNumber(),
      unit_price: line.unitPrice.toNumber(),
      amount_cents: toNumber(line.amountCents),
    };
  }
}

export class InvoiceRecipientDto {
  name!: string;
  tax_id!: string | null;
  address_line!: string | null;
  city!: string | null;
  email!: string | null;
}

export class InvoiceResponseDto {
  id!: string;
  @ApiProperty({ enum: InvoiceSeries })
  series!: InvoiceSeries;
  year!: number;
  number!: number;
  code!: string;
  issue_date!: string;
  operation_date!: string | null;
  client_id!: string | null;
  recipient!: InvoiceRecipientDto;
  tax_rate!: number;
  withholding_rate!: number;
  base_cents!: number;
  tax_cents!: number;
  withholding_cents!: number;
  total_cents!: number;
  @ApiProperty({ enum: InvoiceStatus })
  status!: InvoiceStatus;
  paid_on!: string | null;
  @ApiPropertyOptional({ enum: PaymentMethod, nullable: true })
  payment_method!: PaymentMethod | null;
  notes!: string | null;
  /** Asiento de devengo y de cobro, si ya están contabilizados. */
  journal_entry_id!: string | null;
  payment_entry_id!: string | null;
  /** Cuota de la escuela que originó la factura (no editable a mano). */
  student_fee_id!: string | null;
  lines!: InvoiceLineResponseDto[];
  created_at!: string;
  updated_at!: string;

  static from(
    row: Invoice & { lines?: InvoiceLine[]; studentFee?: { id: string } | null },
  ): InvoiceResponseDto {
    return {
      id: row.id,
      series: row.series,
      year: row.year,
      number: row.number,
      code: row.code,
      issue_date: dateOnly(row.issueDate),
      operation_date: dateOnly(row.operationDate),
      client_id: row.clientId,
      recipient: {
        name: row.recipientName,
        tax_id: row.recipientTaxId,
        address_line: row.recipientAddress,
        city: row.recipientCity,
        email: row.recipientEmail,
      },
      tax_rate: bpToPercent(row.taxRateBp),
      withholding_rate: bpToPercent(row.withholdingRateBp),
      base_cents: toNumber(row.baseCents),
      tax_cents: toNumber(row.taxCents),
      withholding_cents: toNumber(row.withholdingCents),
      total_cents: toNumber(row.totalCents),
      status: row.status,
      paid_on: dateOnly(row.paidOn),
      payment_method: row.paymentMethod,
      notes: row.notes,
      journal_entry_id: row.journalEntryId,
      payment_entry_id: row.paymentEntryId,
      student_fee_id: row.studentFee?.id ?? null,
      lines: (row.lines ?? [])
        .sort((a, b) => a.position - b.position)
        .map((line) => InvoiceLineResponseDto.from(line)),
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }
}

export class PaginatedInvoicesDto extends PaginatedMetaHolder {
  @ApiProperty({ type: [InvoiceResponseDto] })
  data!: InvoiceResponseDto[];
}

export class NextNumberResponseDto {
  code!: string;
}
