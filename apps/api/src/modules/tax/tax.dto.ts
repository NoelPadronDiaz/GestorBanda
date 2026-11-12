import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { IsYear } from '../../common/dto/validators';

export class QuarterQueryDto {
  @Type(() => Number)
  @IsYear()
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  quarter!: number;
}

export class IgicRowDto {
  date!: string;
  number!: string;
  party_name!: string;
  party_tax_id!: string | null;
  activity!: string;
  base_cents!: number;
  tax_rate!: number;
  tax_cents!: number;
}

export class IgicRateSummaryDto {
  tax_rate!: number;
  base_cents!: number;
  tax_cents!: number;
}

/** Libro auxiliar de IGIC para la gestoría; no es una autoliquidación. */
export class IgicReportDto {
  year!: number;
  quarter!: number;
  from!: string;
  to!: string;
  issued!: IgicRowDto[];
  received!: IgicRowDto[];
  issued_by_rate!: IgicRateSummaryDto[];
  received_by_rate!: IgicRateSummaryDto[];
  output_tax_cents!: number;
  input_tax_cents!: number;
  /** Repercutido − soportado registrado (el soportado puede no ser deducible). */
  difference_cents!: number;
}

export class WithholdingRowDto {
  paid_on!: string;
  party_name!: string;
  party_tax_id!: string | null;
  reference!: string;
  base_cents!: number;
  withholding_rate!: number | null;
  withholding_cents!: number;
}

/** Retenciones IRPF practicadas en el trimestre (criterio de pago), para los modelos 111/190. */
export class WithholdingsReportDto {
  year!: number;
  quarter!: number;
  professionals!: WithholdingRowDto[];
  employees!: WithholdingRowDto[];
  professionals_total_cents!: number;
  employees_total_cents!: number;
  total_cents!: number;
}
