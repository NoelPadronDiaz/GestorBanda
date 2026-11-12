import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { SupplierKind, type Supplier } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsPercent } from '../../common/dto/validators';
import { bpToPercent } from '../../common/utils/money';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  tax_id?: string | null;

  @ApiPropertyOptional({ enum: SupplierKind, default: SupplierKind.COMPANY })
  @IsOptional()
  @IsEnum(SupplierKind)
  kind?: SupplierKind;

  @ApiPropertyOptional({ description: 'IRPF habitual en %', example: 15 })
  @IsOptional()
  @IsPercent()
  default_withholding_rate?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  city?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}

export class SupplierResponseDto {
  id!: string;
  name!: string;
  tax_id!: string | null;
  @ApiProperty({ enum: SupplierKind })
  kind!: SupplierKind;
  default_withholding_rate!: number;
  address_line!: string | null;
  city!: string | null;
  email!: string | null;
  phone!: string | null;
  created_at!: string;
  updated_at!: string;

  static from(row: Supplier): SupplierResponseDto {
    return {
      id: row.id,
      name: row.name,
      tax_id: row.taxId,
      kind: row.kind,
      default_withholding_rate: bpToPercent(row.defaultWithholdingBp),
      address_line: row.addressLine,
      city: row.city,
      email: row.email,
      phone: row.phone,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }
}
