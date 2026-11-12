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
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import {
  CreateStudentDto,
  FeeResponseDto,
  GenerateFeesDto,
  GenerateFeesResponseDto,
  ListFeesQueryDto,
  StudentResponseDto,
  TariffDto,
  UpdateStudentDto,
  UpdateTariffsDto,
} from './school.dto';
import { SchoolService } from './school.service';

@ApiTags('school')
@ApiBearerAuth()
@Controller('school')
export class SchoolController {
  constructor(private readonly school: SchoolService) {}

  @Get('students')
  @RequirePermissions('school.read')
  listStudents(): Promise<StudentResponseDto[]> {
    return this.school.listStudents();
  }

  @Post('students')
  @RequirePermissions('school.manage')
  createStudent(@Body() dto: CreateStudentDto): Promise<StudentResponseDto> {
    return this.school.createStudent(dto);
  }

  @Patch('students/:id')
  @RequirePermissions('school.manage')
  updateStudent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ): Promise<StudentResponseDto> {
    return this.school.updateStudent(id, dto);
  }

  @Delete('students/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('school.manage')
  removeStudent(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.school.removeStudent(id);
  }

  @Get('tariffs')
  @RequirePermissions('school.read')
  listTariffs(): Promise<TariffDto[]> {
    return this.school.listTariffs();
  }

  @Put('tariffs')
  @RequirePermissions('school.manage')
  updateTariffs(@Body() dto: UpdateTariffsDto): Promise<TariffDto[]> {
    return this.school.updateTariffs(dto);
  }

  @Get('fees')
  @RequirePermissions('school.read')
  listFees(@Query() query: ListFeesQueryDto): Promise<FeeResponseDto[]> {
    return this.school.listFees(query);
  }

  /** Emite las cuotas del mes con su factura ESC. El cobro se marca en la factura. */
  @Post('fees/generate')
  @RequirePermissions('school.manage')
  generateFees(@Body() dto: GenerateFeesDto): Promise<GenerateFeesResponseDto> {
    return this.school.generateFees(dto);
  }
}
