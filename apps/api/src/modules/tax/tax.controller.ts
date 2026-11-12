import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { IgicReportDto, QuarterQueryDto, WithholdingsReportDto } from './tax.dto';
import { TaxService } from './tax.service';

@ApiTags('tax')
@ApiBearerAuth()
@Controller('tax')
export class TaxController {
  constructor(private readonly tax: TaxService) {}

  @Get('igic')
  @RequirePermissions('tax_reports.read')
  igic(@Query() query: QuarterQueryDto): Promise<IgicReportDto> {
    return this.tax.igic(query);
  }

  @Get('withholdings')
  @RequirePermissions('tax_reports.read')
  withholdings(@Query() query: QuarterQueryDto): Promise<WithholdingsReportDto> {
    return this.tax.withholdings(query);
  }
}
