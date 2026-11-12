import { ApiPropertyOptional } from '@nestjs/swagger';
import type { BandProfile } from '@prisma/client';
import {
  IsEmail,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateBandProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legal_name?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'CIF/NIF de la asociación' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  tax_id?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  postal_code?: string | null;

  @ApiPropertyOptional({ description: 'ISO 3166-1 alpha-2', example: 'ES' })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  country?: string;

  @ApiPropertyOptional({ description: 'ISO 4217', example: 'EUR' })
  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  @Length(3, 3)
  default_currency?: string;

  @ApiPropertyOptional({ example: 'Europe/Madrid' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @ApiPropertyOptional({ nullable: true, example: '1985-06-01' })
  @IsOptional()
  @IsISO8601({ strict: true })
  founded_on?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'IBAN de cobro que figura en las facturas' })
  @IsOptional()
  @IsString()
  @MaxLength(34)
  iban?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Texto al pie de las facturas' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  invoice_footer?: string | null;
}

export class BandProfileResponseDto {
  name!: string;
  legal_name!: string | null;
  tax_id!: string | null;
  email!: string | null;
  phone!: string | null;
  website!: string | null;
  address_line!: string | null;
  city!: string | null;
  postal_code!: string | null;
  country!: string;
  default_currency!: string;
  timezone!: string;
  founded_on!: string | null;
  iban!: string | null;
  invoice_footer!: string | null;
  updated_at!: string;

  static from(profile: BandProfile): BandProfileResponseDto {
    return {
      name: profile.name,
      legal_name: profile.legalName,
      tax_id: profile.taxId,
      email: profile.email,
      phone: profile.phone,
      website: profile.website,
      address_line: profile.addressLine,
      city: profile.city,
      postal_code: profile.postalCode,
      country: profile.country,
      default_currency: profile.defaultCurrency,
      timezone: profile.timezone,
      founded_on: profile.foundedOn ? profile.foundedOn.toISOString().slice(0, 10) : null,
      iban: profile.iban,
      invoice_footer: profile.invoiceFooter,
      updated_at: profile.updatedAt.toISOString(),
    };
  }
}
