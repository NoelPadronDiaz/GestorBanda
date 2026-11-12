import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional } from 'class-validator';
import { IsYear } from '../../common/dto/validators';
import { addMonths, todayUtc } from '../../common/utils/dates';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BillingModule } from '../billing/billing.module';
import type { ExpenseTotalsDto } from '../billing/expenses.dto';
import { ExpensesService } from '../billing/expenses.service';
import { InvoiceResponseDto } from '../billing/invoices.dto';
import { InvoicesService } from '../billing/invoices.service';
import { RecurringExpensesService } from '../billing/recurring.service';
import { GrantsModule } from '../grants/grants.module';
import { GrantsService } from '../grants/grants.service';
import type { SchoolSummaryDto } from '../school/school.dto';
import { SchoolModule } from '../school/school.module';
import { SchoolService } from '../school/school.service';

export class DashboardQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsYear()
  year?: number;
}

export class DashboardAlertDto {
  /** RECURRING_DUE | GRANT_DEADLINE | BANK_PENDING | YEAR_NOT_CLOSED */
  kind!: string;
  count!: number;
  /** Fecha relevante (vencimiento más próximo) o ejercicio. */
  detail!: string | null;
}

export class DashboardDto {
  year!: number;
  invoices!: {
    count: number;
    total_cents: number;
    pending_count: number;
    pending_cents: number;
  } | null;
  expenses!: ExpenseTotalsDto | null;
  school!: SchoolSummaryDto | null;
  recent_invoices!: InvoiceResponseDto[];
  alerts!: DashboardAlertDto[];
}

/** Panel de inicio: cada bloque solo se calcula si el usuario tiene permiso para verlo. */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
    private readonly expenses: ExpensesService,
    private readonly recurring: RecurringExpensesService,
    private readonly school: SchoolService,
    private readonly grants: GrantsService,
  ) {}

  async summary(year: number, user: AuthenticatedUser): Promise<DashboardDto> {
    const can = (permission: AuthenticatedUser['permissions'][number]) =>
      user.permissions.includes(permission);
    const today = todayUtc();
    const alerts: DashboardAlertDto[] = [];

    const [invoices, expenses, school, recent] = await Promise.all([
      can('billing.read') ? this.invoices.yearSummary(year) : null,
      can('billing.read') ? this.expenses.totals(year) : null,
      can('school.read') ? this.school.summary(year) : null,
      can('billing.read')
        ? this.invoices.list({ page: 1, page_size: 5, year }).then((page) => page.data)
        : [],
    ]);

    if (can('billing.read')) {
      const due = await this.recurring.dueUntil(new Date(today.getTime() + 7 * 86_400_000));
      if (due.length)
        alerts.push({ kind: 'RECURRING_DUE', count: due.length, detail: due[0].next_due_on });
    }
    if (can('grants.read')) {
      const deadlines = await this.grants.upcomingDeadlines(addMonths(today, 1));
      if (deadlines.length) {
        alerts.push({
          kind: 'GRANT_DEADLINE',
          count: deadlines.length,
          detail: deadlines[0].deadline,
        });
      }
    }
    if (can('treasury.read')) {
      const pending = await this.prisma.bankMovement.count({ where: { journalEntryId: null } });
      if (pending) alerts.push({ kind: 'BANK_PENDING', count: pending, detail: null });
    }
    if (can('accounting.read')) {
      const previous = year - 1;
      const [fiscalYear, entries] = await Promise.all([
        this.prisma.fiscalYear.findUnique({ where: { year: previous } }),
        this.prisma.journalEntry.count({ where: { year: previous } }),
      ]);
      if (entries && fiscalYear?.status !== 'CLOSED') {
        alerts.push({ kind: 'YEAR_NOT_CLOSED', count: entries, detail: String(previous) });
      }
    }

    return { year, invoices, expenses, school, recent_invoices: recent, alerts };
  }
}

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** Sin permiso específico: devuelve solo los bloques que el usuario puede ver. */
  @Get()
  summary(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DashboardDto> {
    return this.dashboard.summary(query.year ?? new Date().getUTCFullYear(), user);
  }
}

@Module({
  imports: [BillingModule, SchoolModule, GrantsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
