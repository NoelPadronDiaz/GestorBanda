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
  CreateGrantDto,
  GrantQueryDto,
  GrantResponseDto,
  LinkExpenseDto,
  UpdateGrantDto,
} from './grants.dto';
import { GrantsService } from './grants.service';

@ApiTags('grants')
@ApiBearerAuth()
@Controller('grants')
export class GrantsController {
  constructor(private readonly grants: GrantsService) {}

  @Get()
  @RequirePermissions('grants.read')
  list(@Query() query: GrantQueryDto): Promise<GrantResponseDto[]> {
    return this.grants.list(query);
  }

  @Post()
  @RequirePermissions('grants.manage')
  create(@Body() dto: CreateGrantDto): Promise<GrantResponseDto> {
    return this.grants.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('grants.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGrantDto,
  ): Promise<GrantResponseDto> {
    return this.grants.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('grants.manage')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.grants.remove(id);
  }

  /** Imputar un gasto a la justificación (requiere poder ver los gastos). */
  @Post(':id/expenses')
  @RequirePermissions('grants.manage', 'billing.read')
  linkExpense(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkExpenseDto,
  ): Promise<GrantResponseDto> {
    return this.grants.linkExpense(id, dto);
  }

  @Delete(':id/expenses/:expenseId')
  @RequirePermissions('grants.manage')
  unlinkExpense(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
  ): Promise<GrantResponseDto> {
    return this.grants.unlinkExpense(id, expenseId);
  }
}
