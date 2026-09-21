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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { MAX_UPLOAD_BYTES } from './documents.constants';
import {
  DocumentResponseDto,
  DownloadUrlResponseDto,
  ListDocumentsQueryDto,
  PaginatedDocumentsDto,
  UploadDocumentDto,
} from './documents.dto';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @RequirePermissions('documents.upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        category: { type: 'string' },
        entity_type: { type: 'string' },
        entity_id: { type: 'string', format: 'uuid' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<DocumentResponseDto> {
    return this.documents.upload(file, dto, actor);
  }

  @Get()
  @RequirePermissions('documents.read')
  list(@Query() query: ListDocumentsQueryDto): Promise<PaginatedDocumentsDto> {
    return this.documents.list(query);
  }

  @Get(':id')
  @RequirePermissions('documents.read')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<DocumentResponseDto> {
    return this.documents.findOneOrFail(id);
  }

  @Post(':id/download-url')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('documents.read')
  createDownloadUrl(@Param('id', ParseUUIDPipe) id: string): Promise<DownloadUrlResponseDto> {
    return this.documents.createDownloadUrl(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('documents.delete')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.documents.remove(id);
  }
}
