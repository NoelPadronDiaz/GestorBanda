import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import {
  CreateInvoiceDto,
  InvoiceResponseDto,
  ListInvoicesQueryDto,
  MarkPaidDto,
  NextNumberQueryDto,
  NextNumberResponseDto,
  PaginatedInvoicesDto,
  UpdateInvoiceDto,
} from './invoices.dto';
import { InvoicesService } from './invoices.service';

/** Las facturas no se borran: se anulan (el número queda consumido) o se rectifican. */
@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing/invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @RequirePermissions('billing.read')
  list(@Query() query: ListInvoicesQueryDto): Promise<PaginatedInvoicesDto> {
    return this.invoices.list(query);
  }

  @Get('next-number')
  @RequirePermissions('billing.read')
  async nextNumber(@Query() query: NextNumberQueryDto): Promise<NextNumberResponseDto> {
    return { code: await this.invoices.peekNextCode(query.series, query.year) };
  }

  @Get(':id')
  @RequirePermissions('billing.read')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<InvoiceResponseDto> {
    return this.invoices.findOneOrFail(id);
  }

  @Post()
  @RequirePermissions('billing.manage')
  create(@Body() dto: CreateInvoiceDto): Promise<InvoiceResponseDto> {
    return this.invoices.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('billing.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    return this.invoices.update(id, dto);
  }

  @Post(':id/mark-paid')
  @RequirePermissions('billing.manage')
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkPaidDto,
  ): Promise<InvoiceResponseDto> {
    return this.invoices.markPaid(id, dto);
  }

  @Post(':id/mark-pending')
  @RequirePermissions('billing.manage')
  markPending(@Param('id', ParseUUIDPipe) id: string): Promise<InvoiceResponseDto> {
    return this.invoices.markPending(id);
  }

  @Post(':id/cancel')
  @RequirePermissions('billing.manage')
  cancel(@Param('id', ParseUUIDPipe) id: string): Promise<InvoiceResponseDto> {
    return this.invoices.cancel(id);
  }
}
