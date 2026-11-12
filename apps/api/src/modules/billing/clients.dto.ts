import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import type { Client } from '@prisma/client';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginatedMetaHolder } from '../../common/dto/paginated.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ nullable: true, description: 'NIF/CIF' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  tax_id?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Código postal, municipio y provincia' })
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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateClientDto extends PartialType(CreateClientDto) {}

export class ListClientsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca por nombre o NIF' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class ClientResponseDto {
  id!: string;
  name!: string;
  tax_id!: string | null;
  address_line!: string | null;
  city!: string | null;
  email!: string | null;
  phone!: string | null;
  notes!: string | null;
  created_at!: string;
  updated_at!: string;

  static from(row: Client): ClientResponseDto {
    return {
      id: row.id,
      name: row.name,
      tax_id: row.taxId,
      address_line: row.addressLine,
      city: row.city,
      email: row.email,
      phone: row.phone,
      notes: row.notes,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }
}

export class PaginatedClientsDto extends PaginatedMetaHolder {
  data!: ClientResponseDto[];
}
