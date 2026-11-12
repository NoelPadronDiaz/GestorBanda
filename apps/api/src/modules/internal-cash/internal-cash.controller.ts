import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import {
  CashMovementResponseDto,
  CashQueryDto,
  CashReportDto,
  CreateCashMovementDto,
  UpdateCashMovementDto,
} from './internal-cash.dto';
import { InternalCashService } from './internal-cash.service';

@ApiTags('internal-cash')
@ApiBearerAuth()
@Controller('internal-cash')
export class InternalCashController {
  constructor(private readonly cash: InternalCashService) {}

  @Get()
  @RequirePermissions('internal_cash.read')
  report(@Query() query: CashQueryDto): Promise<CashReportDto> {
    return this.cash.report(query);
  }

  @Post()
  @RequirePermissions('internal_cash.manage')
  create(@Body() dto: CreateCashMovementDto): Promise<CashMovementResponseDto> {
    return this.cash.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('internal_cash.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCashMovementDto,
  ): Promise<CashMovementResponseDto> {
    return this.cash.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('internal_cash.manage')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.cash.remove(id);
  }
}
