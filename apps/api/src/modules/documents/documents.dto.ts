import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentCategory, type Document } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginatedMetaHolder } from '../../common/dto/paginated.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { DOCUMENT_ENTITY_TYPES, type DocumentEntityType } from './documents.constants';

export class UploadDocumentDto {
  @ApiPropertyOptional({ enum: DocumentCategory, default: DocumentCategory.OTHER })
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @ApiPropertyOptional({ enum: DOCUMENT_ENTITY_TYPES, description: 'Junto con entity_id' })
  @IsOptional()
  @IsIn(DOCUMENT_ENTITY_TYPES)
  entity_type?: DocumentEntityType;

  @ApiPropertyOptional({ description: 'Junto con entity_type' })
  @IsOptional()
  @IsUUID()
  entity_id?: string;
}

export class ListDocumentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DOCUMENT_ENTITY_TYPES })
  @IsOptional()
  @IsIn(DOCUMENT_ENTITY_TYPES)
  entity_type?: DocumentEntityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  entity_id?: string;

  @ApiPropertyOptional({ enum: DocumentCategory })
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;
}

/** Nunca incluye storage_key: el cliente no necesita (ni debe conocer) la ruta interna del fichero. */
export class DocumentResponseDto {
  id!: string;
  original_filename!: string;
  mime_type!: string;
  size_bytes!: number;
  sha256!: string;
  @ApiProperty({ enum: DocumentCategory })
  category!: DocumentCategory;
  entity_type!: string | null;
  entity_id!: string | null;
  uploaded_by_id!: string | null;
  created_at!: string;

  static from(document: Document): DocumentResponseDto {
    return {
      id: document.id,
      original_filename: document.originalFilename,
      mime_type: document.mimeType,
      size_bytes: document.sizeBytes,
      sha256: document.sha256,
      category: document.category,
      entity_type: document.entityType,
      entity_id: document.entityId,
      uploaded_by_id: document.uploadedById,
      created_at: document.createdAt.toISOString(),
    };
  }
}

export class PaginatedDocumentsDto extends PaginatedMetaHolder {
  @ApiProperty({ type: [DocumentResponseDto] })
  data!: DocumentResponseDto[];
}

export class DownloadUrlResponseDto {
  @ApiProperty({ description: 'URL firmada de un solo propósito y corta duración' })
  url!: string;
  expires_at!: string;
}
