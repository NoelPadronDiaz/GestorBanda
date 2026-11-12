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
  CreateExpenseDto,
  ExpenseResponseDto,
  ExpenseTotalsDto,
  ListExpensesQueryDto,
  MarkExpensePaidDto,
  PaginatedExpensesDto,
  UpdateExpenseDto,
} from './expenses.dto';
import { ExpensesService } from './expenses.service';
import {
  CreateRecurringExpenseDto,
  RecurringExpenseResponseDto,
  UpdateRecurringExpenseDto,
} from './recurring.dto';
import { RecurringExpensesService } from './recurring.service';
import { CreateSupplierDto, SupplierResponseDto, UpdateSupplierDto } from './suppliers.dto';
import { SuppliersService } from './suppliers.service';

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing/suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @RequirePermissions('billing.read')
  list(): Promise<SupplierResponseDto[]> {
    return this.suppliers.list();
  }

  @Post()
  @RequirePermissions('billing.manage')
  create(@Body() dto: CreateSupplierDto): Promise<SupplierResponseDto> {
    return this.suppliers.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('billing.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
  ): Promise<SupplierResponseDto> {
    return this.suppliers.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('billing.manage')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.suppliers.remove(id);
  }
}

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing/expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  @RequirePermissions('billing.read')
  list(@Query() query: ListExpensesQueryDto): Promise<PaginatedExpensesDto> {
    return this.expenses.list(query);
  }

  @Get('totals')
  @RequirePermissions('billing.read')
  totals(@Query() query: ListExpensesQueryDto): Promise<ExpenseTotalsDto> {
    return this.expenses.totals(query.year);
  }

  @Get(':id')
  @RequirePermissions('billing.read')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ExpenseResponseDto> {
    return this.expenses.findOneOrFail(id);
  }

  @Post()
  @RequirePermissions('billing.manage')
  create(@Body() dto: CreateExpenseDto): Promise<ExpenseResponseDto> {
    return this.expenses.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('billing.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
  ): Promise<ExpenseResponseDto> {
    return this.expenses.update(id, dto);
  }

  @Post(':id/mark-paid')
  @RequirePermissions('billing.manage')
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkExpensePaidDto,
  ): Promise<ExpenseResponseDto> {
    return this.expenses.markPaid(id, dto);
  }

  @Post(':id/mark-pending')
  @RequirePermissions('billing.manage')
  markPending(@Param('id', ParseUUIDPipe) id: string): Promise<ExpenseResponseDto> {
    return this.expenses.markPending(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('billing.manage')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.expenses.remove(id);
  }
}

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing/recurring-expenses')
export class RecurringExpensesController {
  constructor(private readonly recurring: RecurringExpensesService) {}

  @Get()
  @RequirePermissions('billing.read')
  list(): Promise<RecurringExpenseResponseDto[]> {
    return this.recurring.list();
  }

  @Post()
  @RequirePermissions('billing.manage')
  create(@Body() dto: CreateRecurringExpenseDto): Promise<RecurringExpenseResponseDto> {
    return this.recurring.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('billing.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecurringExpenseDto,
  ): Promise<RecurringExpenseResponseDto> {
    return this.recurring.update(id, dto);
  }

  /** Pasa al siguiente vencimiento (no registra ningún pago). */
  @Post(':id/advance')
  @RequirePermissions('billing.manage')
  advance(@Param('id', ParseUUIDPipe) id: string): Promise<RecurringExpenseResponseDto> {
    return this.recurring.advance(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('billing.manage')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.recurring.remove(id);
  }
}
