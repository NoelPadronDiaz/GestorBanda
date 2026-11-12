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
  BudgetLineResponseDto,
  BudgetQueryDto,
  BudgetReportDto,
  CreateBudgetLineDto,
  UpdateBudgetLineDto,
} from './budgets.dto';
import { BudgetsService } from './budgets.service';

@ApiTags('budgets')
@ApiBearerAuth()
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  @RequirePermissions('budgets.read', 'accounting.read')
  report(@Query() query: BudgetQueryDto): Promise<BudgetReportDto> {
    return this.budgets.report(query);
  }

  @Post()
  @RequirePermissions('budgets.manage')
  create(@Body() dto: CreateBudgetLineDto): Promise<BudgetLineResponseDto> {
    return this.budgets.create(dto);
  }

  @Post('copy-year')
  @RequirePermissions('budgets.manage')
  copyYear(@Query() query: BudgetQueryDto): Promise<{ copied: number }> {
    return this.budgets.copyYear(query.year);
  }

  @Patch(':id')
  @RequirePermissions('budgets.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBudgetLineDto,
  ): Promise<BudgetLineResponseDto> {
    return this.budgets.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('budgets.manage')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.budgets.remove(id);
  }
}
