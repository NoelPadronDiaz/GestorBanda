import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  InvoiceStatus,
  PaymentMethod,
  SchoolModality,
  SchoolTariffKey,
  SchoolTariffKind,
  StudentStatus,
  type Invoice,
  type SchoolTariff,
  type Student,
  type StudentFee,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IsCents, IsDateOnly, IsPeriod } from '../../common/dto/validators';
import { dateOnly, periodOf } from '../../common/utils/dates';
import { toNullableNumber, toNumber } from '../../common/utils/money';

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  full_name!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Ficha de miembro vinculada' })
  @IsOptional()
  @IsUUID()
  member_id?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Familia Rodríguez' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  family_label?: string | null;

  @ApiProperty({ enum: SchoolModality })
  @IsEnum(SchoolModality)
  modality!: SchoolModality;

  @ApiPropertyOptional({ enum: SchoolTariffKind, default: SchoolTariffKind.ORDINARY })
  @IsOptional()
  @IsEnum(SchoolTariffKind)
  tariff_kind?: SchoolTariffKind;

  @ApiPropertyOptional({ nullable: true, description: 'Solo con tarifa CUSTOM; IGIC incluido' })
  @IsOptional()
  @IsCents({ required: false })
  custom_fee_cents?: number | null;

  @ApiPropertyOptional({ enum: StudentStatus })
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateOnly()
  enrolled_on?: string | null;

  @ApiPropertyOptional({ enum: PaymentMethod, nullable: true })
  @IsOptional()
  @IsEnum(PaymentMethod)
  payment_method?: PaymentMethod | null;

  @ApiPropertyOptional({ nullable: true, description: 'Destinatario de las facturas' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  billing_name?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  billing_tax_id?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  billing_address?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  billing_city?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  billing_email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  billing_phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateStudentDto extends PartialType(CreateStudentDto) {}

export class StudentResponseDto {
  id!: string;
  member_id!: string | null;
  full_name!: string;
  family_label!: string | null;
  @ApiProperty({ enum: SchoolModality })
  modality!: SchoolModality;
  @ApiProperty({ enum: SchoolTariffKind })
  tariff_kind!: SchoolTariffKind;
  custom_fee_cents!: number | null;
  /** Cuota mensual que se aplicará con las tarifas actuales (null = tarifa sin definir). */
  monthly_fee_cents!: number | null;
  @ApiProperty({ enum: StudentStatus })
  status!: StudentStatus;
  enrolled_on!: string | null;
  payment_method!: PaymentMethod | null;
  billing_name!: string | null;
  billing_tax_id!: string | null;
  billing_address!: string | null;
  billing_city!: string | null;
  billing_email!: string | null;
  billing_phone!: string | null;
  /** Campos de facturación que faltan para poder emitir sus cuotas. */
  missing_billing_fields!: string[];
  notes!: string | null;
  created_at!: string;
  updated_at!: string;

  static from(row: Student, monthlyFeeCents: number | null): StudentResponseDto {
    return {
      id: row.id,
      member_id: row.memberId,
      full_name: row.fullName,
      family_label: row.familyLabel,
      modality: row.modality,
      tariff_kind: row.tariffKind,
      custom_fee_cents: toNullableNumber(row.customFeeCents),
      monthly_fee_cents: monthlyFeeCents,
      status: row.status,
      enrolled_on: dateOnly(row.enrolledOn),
      payment_method: row.paymentMethod,
      billing_name: row.billingName,
      billing_tax_id: row.billingTaxId,
      billing_address: row.billingAddress,
      billing_city: row.billingCity,
      billing_email: row.billingEmail,
      billing_phone: row.billingPhone,
      missing_billing_fields: missingBillingFields(row),
      notes: row.notes,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }
}

export function missingBillingFields(row: Student): string[] {
  const required: [string, string | null][] = [
    ['billing_name', row.billingName],
    ['billing_tax_id', row.billingTaxId],
    ['billing_address', row.billingAddress],
    ['billing_city', row.billingCity],
  ];
  return required.filter(([, value]) => !value?.trim()).map(([field]) => field);
}

export class TariffDto {
  @ApiProperty({ enum: SchoolTariffKey })
  @IsEnum(SchoolTariffKey)
  key!: SchoolTariffKey;

  @ApiPropertyOptional({ nullable: true, description: 'IGIC incluido; null = sin definir' })
  @IsOptional()
  @IsCents({ required: false })
  amount_cents!: number | null;

  static from(row: SchoolTariff): TariffDto {
    return { key: row.key, amount_cents: toNullableNumber(row.amountCents) };
  }
}

export class UpdateTariffsDto {
  @ApiProperty({ type: [TariffDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TariffDto)
  tariffs!: TariffDto[];
}

export class GenerateFeesDto {
  @ApiProperty({ example: '2026-11' })
  @IsPeriod()
  period!: string;

  @ApiPropertyOptional({ description: 'Fecha de emisión de las facturas; por defecto, hoy' })
  @IsOptional()
  @IsDateOnly()
  issue_date?: string;
}

export class ListFeesQueryDto {
  @ApiPropertyOptional({ example: '2026-11' })
  @IsOptional()
  @IsPeriod()
  period?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  student_id?: string;
}

export class FeeResponseDto {
  id!: string;
  student_id!: string;
  student_name!: string;
  period!: string;
  amount_cents!: number;
  invoice_id!: string;
  invoice_code!: string;
  @ApiProperty({ enum: InvoiceStatus })
  status!: InvoiceStatus;
  paid_on!: string | null;

  static from(row: StudentFee & { student: Student; invoice: Invoice }): FeeResponseDto {
    return {
      id: row.id,
      student_id: row.studentId,
      student_name: row.student.fullName,
      period: periodOf(row.period),
      amount_cents: toNumber(row.amountCents),
      invoice_id: row.invoiceId,
      invoice_code: row.invoice.code,
      status: row.invoice.status,
      paid_on: dateOnly(row.invoice.paidOn),
    };
  }
}

export class SkippedFeeDto {
  student_id!: string;
  student_name!: string;
  /** NO_TARIFF | MISSING_BILLING_DATA */
  reason!: string;
  missing_fields!: string[];
}

export class GenerateFeesResponseDto {
  created!: FeeResponseDto[];
  skipped!: SkippedFeeDto[];
  already_existing!: number;
}

export class SchoolSummaryDto {
  active_students!: number;
  fees_total_cents!: number;
  fees_pending_cents!: number;
  fees_pending_count!: number;
}
