import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Activity, PaymentMethod, PayrollStatus, type Payroll, type Worker } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsCents, IsDateOnly, IsPeriod, IsYear } from '../../common/dto/validators';
import { dateOnly, periodOf } from '../../common/utils/dates';
import { toNumber } from '../../common/utils/money';

export class CreateWorkerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  full_name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(130)
  role_title?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Ficha de miembro vinculada' })
  @IsOptional()
  @IsUUID()
  member_id?: string | null;

  @ApiPropertyOptional({ enum: Activity, default: Activity.SCHOOL })
  @IsOptional()
  @IsEnum(Activity)
  activity?: Activity;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateWorkerDto extends PartialType(CreateWorkerDto) {}

export class WorkerResponseDto {
  id!: string;
  full_name!: string;
  role_title!: string | null;
  member_id!: string | null;
  @ApiProperty({ enum: Activity })
  activity!: Activity;
  active!: boolean;

  static from(row: Worker): WorkerResponseDto {
    return {
      id: row.id,
      full_name: row.fullName,
      role_title: row.roleTitle,
      member_id: row.memberId,
      activity: row.activity,
      active: row.active,
    };
  }
}

/** Importes tal y como figuran en la nómina de la gestoría. El líquido lo calcula la API. */
export class CreatePayrollDto {
  @IsUUID()
  worker_id!: string;

  @ApiProperty({ example: '2026-11' })
  @IsPeriod()
  period!: string;

  @ApiProperty({ description: 'Fecha de devengo (dentro del mes)' })
  @IsDateOnly()
  accrual_date!: string;

  @ApiProperty({ enum: Activity })
  @IsEnum(Activity)
  activity!: Activity;

  @IsCents()
  gross_cents!: number;

  @IsCents()
  employee_ss_cents!: number;

  @IsCents()
  irpf_cents!: number;

  @IsCents()
  other_deductions_cents!: number;

  @IsCents()
  employer_ss_cents!: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdatePayrollDto extends PartialType(CreatePayrollDto) {}

export class MarkPayrollPaidDto {
  @IsDateOnly()
  paid_on!: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  payment_method!: PaymentMethod;
}

export class ListPayrollsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsYear()
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  worker_id?: string;
}

export class PayrollResponseDto {
  id!: string;
  worker_id!: string;
  worker_name!: string;
  period!: string;
  accrual_date!: string;
  @ApiProperty({ enum: Activity })
  activity!: Activity;
  gross_cents!: number;
  employee_ss_cents!: number;
  irpf_cents!: number;
  other_deductions_cents!: number;
  employer_ss_cents!: number;
  net_cents!: number;
  /** Coste para la entidad = bruto + SS empresa. */
  cost_cents!: number;
  @ApiProperty({ enum: PayrollStatus })
  status!: PayrollStatus;
  paid_on!: string | null;
  payment_method!: PaymentMethod | null;
  notes!: string | null;
  journal_entry_id!: string | null;
  payment_entry_id!: string | null;

  static from(row: Payroll & { worker: Worker }): PayrollResponseDto {
    return {
      id: row.id,
      worker_id: row.workerId,
      worker_name: row.worker.fullName,
      period: periodOf(row.period),
      accrual_date: dateOnly(row.accrualDate),
      activity: row.activity,
      gross_cents: toNumber(row.grossCents),
      employee_ss_cents: toNumber(row.employeeSsCents),
      irpf_cents: toNumber(row.irpfCents),
      other_deductions_cents: toNumber(row.otherDeductionsCents),
      employer_ss_cents: toNumber(row.employerSsCents),
      net_cents: toNumber(row.netCents),
      cost_cents: toNumber(row.grossCents) + toNumber(row.employerSsCents),
      status: row.status,
      paid_on: dateOnly(row.paidOn),
      payment_method: row.paymentMethod,
      notes: row.notes,
      journal_entry_id: row.journalEntryId,
      payment_entry_id: row.paymentEntryId,
    };
  }
}
