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
  CreateMemberDto,
  ListMembersQueryDto,
  MemberResponseDto,
  PaginatedMembersDto,
  UpdateMemberDto,
} from './members.dto';
import { MembersService } from './members.service';

@ApiTags('members')
@ApiBearerAuth()
@Controller('members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @RequirePermissions('members.read')
  list(@Query() query: ListMembersQueryDto): Promise<PaginatedMembersDto> {
    return this.members.list(query);
  }

  @Get(':id')
  @RequirePermissions('members.read')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<MemberResponseDto> {
    return this.members.findOneOrFail(id);
  }

  @Post()
  @RequirePermissions('members.create')
  create(@Body() dto: CreateMemberDto): Promise<MemberResponseDto> {
    return this.members.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('members.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemberDto,
  ): Promise<MemberResponseDto> {
    return this.members.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('members.delete')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.members.remove(id);
  }
}
