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
  CreatePayrollDto,
  CreateWorkerDto,
  ListPayrollsQueryDto,
  MarkPayrollPaidDto,
  PayrollResponseDto,
  UpdatePayrollDto,
  UpdateWorkerDto,
  WorkerResponseDto,
} from './payroll.dto';
import { PayrollService } from './payroll.service';

@ApiTags('payroll')
@ApiBearerAuth()
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get('workers')
  @RequirePermissions('payroll.read')
  listWorkers(): Promise<WorkerResponseDto[]> {
    return this.payroll.listWorkers();
  }

  @Post('workers')
  @RequirePermissions('payroll.manage')
  createWorker(@Body() dto: CreateWorkerDto): Promise<WorkerResponseDto> {
    return this.payroll.createWorker(dto);
  }

  @Patch('workers/:id')
  @RequirePermissions('payroll.manage')
  updateWorker(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkerDto,
  ): Promise<WorkerResponseDto> {
    return this.payroll.updateWorker(id, dto);
  }

  @Delete('workers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('payroll.manage')
  removeWorker(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.payroll.removeWorker(id);
  }

  @Get('payrolls')
  @RequirePermissions('payroll.read')
  listPayrolls(@Query() query: ListPayrollsQueryDto): Promise<PayrollResponseDto[]> {
    return this.payroll.listPayrolls(query);
  }

  @Post('payrolls')
  @RequirePermissions('payroll.manage')
  createPayroll(@Body() dto: CreatePayrollDto): Promise<PayrollResponseDto> {
    return this.payroll.createPayroll(dto);
  }

  @Patch('payrolls/:id')
  @RequirePermissions('payroll.manage')
  updatePayroll(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePayrollDto,
  ): Promise<PayrollResponseDto> {
    return this.payroll.updatePayroll(id, dto);
  }

  @Post('payrolls/:id/mark-paid')
  @RequirePermissions('payroll.manage')
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkPayrollPaidDto,
  ): Promise<PayrollResponseDto> {
    return this.payroll.markPaid(id, dto);
  }

  @Post('payrolls/:id/mark-pending')
  @RequirePermissions('payroll.manage')
  markPending(@Param('id', ParseUUIDPipe) id: string): Promise<PayrollResponseDto> {
    return this.payroll.markPending(id);
  }

  @Delete('payrolls/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('payroll.manage')
  removePayroll(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.payroll.removePayroll(id);
  }
}
