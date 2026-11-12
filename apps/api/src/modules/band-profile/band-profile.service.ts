import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BandProfileResponseDto, type UpdateBandProfileDto } from './band-profile.dto';

/** Id fijo de la fila única (CHECK id = 1 en BD). La fila la crea la migración inicial. */
export const BAND_PROFILE_ID = 1;

@Injectable()
export class BandProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<BandProfileResponseDto> {
    const profile = await this.prisma.bandProfile.findUniqueOrThrow({
      where: { id: BAND_PROFILE_ID },
    });
    return BandProfileResponseDto.from(profile);
  }

  async update(dto: UpdateBandProfileDto): Promise<BandProfileResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.bandProfile.findUniqueOrThrow({ where: { id: BAND_PROFILE_ID } });
      const updated = await tx.bandProfile.update({
        where: { id: BAND_PROFILE_ID },
        data: {
          // Columnas obligatorias: null se ignora.
          name: dto.name ?? undefined,
          legalName: dto.legal_name,
          taxId: dto.tax_id,
          email: dto.email,
          phone: dto.phone,
          website: dto.website,
          addressLine: dto.address_line,
          city: dto.city,
          postalCode: dto.postal_code,
          country: dto.country ?? undefined,
          defaultCurrency: dto.default_currency ?? undefined,
          timezone: dto.timezone ?? undefined,
          foundedOn:
            dto.founded_on === undefined || dto.founded_on === null
              ? dto.founded_on
              : new Date(dto.founded_on),
          iban: dto.iban === undefined ? undefined : dto.iban?.replace(/\s+/g, ' ').trim() || null,
          invoiceFooter: dto.invoice_footer,
        },
      });
      const response = BandProfileResponseDto.from(updated);
      await this.audit.record(
        {
          action: 'band_profile.updated',
          entityType: 'BAND_PROFILE',
          entityId: BAND_PROFILE_ID,
          before: BandProfileResponseDto.from(before),
          after: response,
        },
        tx,
      );
      return response;
    });
  }
}
