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
  ClientResponseDto,
  CreateClientDto,
  ListClientsQueryDto,
  PaginatedClientsDto,
  UpdateClientDto,
} from './clients.dto';
import { ClientsService } from './clients.service';

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing/clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  @RequirePermissions('billing.read')
  list(@Query() query: ListClientsQueryDto): Promise<PaginatedClientsDto> {
    return this.clients.list(query);
  }

  @Get(':id')
  @RequirePermissions('billing.read')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ClientResponseDto> {
    return this.clients.findOneOrFail(id);
  }

  @Post()
  @RequirePermissions('billing.manage')
  create(@Body() dto: CreateClientDto): Promise<ClientResponseDto> {
    return this.clients.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('billing.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ): Promise<ClientResponseDto> {
    return this.clients.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('billing.manage')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.clients.remove(id);
  }
}
