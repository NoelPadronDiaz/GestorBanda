import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import {
  BankMovementResponseDto,
  CandidateDto,
  ImportBankMovementsDto,
  ImportResultDto,
  ListBankMovementsQueryDto,
  ReconcileDto,
  TreasurySummaryDto,
} from './treasury.dto';
import { TreasuryService } from './treasury.service';

@ApiTags('treasury')
@ApiBearerAuth()
@Controller('treasury')
export class TreasuryController {
  constructor(private readonly treasury: TreasuryService) {}

  @Get('summary')
  @RequirePermissions('treasury.read')
  summary(@Query() query: ListBankMovementsQueryDto): Promise<TreasurySummaryDto> {
    return this.treasury.summary(query.year);
  }

  @Get('bank-movements')
  @RequirePermissions('treasury.read')
  list(@Query() query: ListBankMovementsQueryDto): Promise<BankMovementResponseDto[]> {
    return this.treasury.list(query);
  }

  @Post('bank-movements/import')
  @RequirePermissions('treasury.manage')
  import(@Body() dto: ImportBankMovementsDto): Promise<ImportResultDto> {
    return this.treasury.import(dto);
  }

  @Get('bank-movements/:id/candidates')
  @RequirePermissions('treasury.read')
  candidates(@Param('id', ParseUUIDPipe) id: string): Promise<CandidateDto[]> {
    return this.treasury.candidates(id);
  }

  @Post('bank-movements/:id/reconcile')
  @RequirePermissions('treasury.manage')
  reconcile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReconcileDto,
  ): Promise<BankMovementResponseDto> {
    return this.treasury.reconcile(id, dto);
  }

  @Post('bank-movements/:id/unreconcile')
  @RequirePermissions('treasury.manage')
  unreconcile(@Param('id', ParseUUIDPipe) id: string): Promise<BankMovementResponseDto> {
    return this.treasury.unreconcile(id);
  }

  @Delete('bank-movements/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('treasury.manage')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.treasury.remove(id);
  }
}
