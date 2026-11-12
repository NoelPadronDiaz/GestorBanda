import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  AccountResponseDto,
  BalanceSheetDto,
  ClosePreviewDto,
  CreateAccountDto,
  EntryResponseDto,
  FiscalYearResponseDto,
  IncomeStatementDto,
  LedgerQueryDto,
  LedgerResponseDto,
  ListEntriesQueryDto,
  PaginatedEntriesDto,
  PendingDocumentDto,
  PendingQueryDto,
  PostEntryDto,
  ProposalQueryDto,
  ProposalResponseDto,
  ReportQueryDto,
  TrialBalanceRowDto,
} from './accounting.dto';
import { FiscalYearsService } from './fiscal-years.service';
import { JournalService } from './journal.service';

@ApiTags('accounting')
@ApiBearerAuth()
@Controller('accounting')
export class AccountingController {
  constructor(
    private readonly journal: JournalService,
    private readonly fiscalYears: FiscalYearsService,
  ) {}

  @Get('accounts')
  @RequirePermissions('accounting.read')
  listAccounts(): Promise<AccountResponseDto[]> {
    return this.journal.listAccounts();
  }

  @Post('accounts')
  @RequirePermissions('accounting.post')
  createAccount(@Body() dto: CreateAccountDto): Promise<AccountResponseDto> {
    return this.journal.createAccount(dto);
  }

  @Get('entries')
  @RequirePermissions('accounting.read')
  listEntries(@Query() query: ListEntriesQueryDto): Promise<PaginatedEntriesDto> {
    return this.journal.list(query);
  }

  /** Cola de contabilización: devengos y cobros/pagos sin asiento en el ejercicio. */
  @Get('pending')
  @RequirePermissions('accounting.read')
  pending(@Query() query: PendingQueryDto): Promise<PendingDocumentDto[]> {
    return this.journal.pending(query.year);
  }

  /** Propuesta de asiento para un documento; el usuario la revisa y la envía a POST /entries. */
  @Get('proposals')
  @RequirePermissions('accounting.post')
  proposal(@Query() query: ProposalQueryDto): Promise<ProposalResponseDto> {
    return this.journal.proposal(query);
  }

  @Get('entries/:id')
  @RequirePermissions('accounting.read')
  findEntry(@Param('id', ParseUUIDPipe) id: string): Promise<EntryResponseDto> {
    return this.journal.findOneOrFail(id);
  }

  @Post('entries')
  @RequirePermissions('accounting.post')
  post(
    @Body() dto: PostEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EntryResponseDto> {
    return this.journal.post(dto, user);
  }

  @Post('entries/:id/reverse')
  @RequirePermissions('accounting.post')
  reverse(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EntryResponseDto> {
    return this.journal.reverse(id, user);
  }

  @Get('ledger')
  @RequirePermissions('accounting.read')
  ledger(@Query() query: LedgerQueryDto): Promise<LedgerResponseDto> {
    return this.journal.ledger(query);
  }

  @Get('trial-balance')
  @RequirePermissions('accounting.read')
  trialBalance(@Query() query: ReportQueryDto): Promise<TrialBalanceRowDto[]> {
    return this.journal.trialBalance(query);
  }

  @Get('income-statement')
  @RequirePermissions('accounting.read')
  incomeStatement(@Query() query: ReportQueryDto): Promise<IncomeStatementDto> {
    return this.journal.incomeStatement(query);
  }

  @Get('balance-sheet')
  @RequirePermissions('accounting.read')
  balanceSheet(@Query() query: ReportQueryDto): Promise<BalanceSheetDto> {
    return this.journal.balanceSheet(query.year);
  }

  @Get('fiscal-years')
  @RequirePermissions('accounting.read')
  listFiscalYears(): Promise<FiscalYearResponseDto[]> {
    return this.fiscalYears.list();
  }

  @Get('fiscal-years/:year/close-preview')
  @RequirePermissions('accounting.read')
  closePreview(@Param('year', ParseIntPipe) year: number): Promise<ClosePreviewDto> {
    return this.fiscalYears.preview(year);
  }

  @Post('fiscal-years/:year/close')
  @RequirePermissions('accounting.close')
  close(
    @Param('year', ParseIntPipe) year: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClosePreviewDto> {
    return this.fiscalYears.close(year, user);
  }
}
