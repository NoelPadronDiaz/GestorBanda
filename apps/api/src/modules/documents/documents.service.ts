import { createHash, randomUUID } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Document, Prisma } from '@prisma/client';
import { paginationMeta, skipTake } from '../../common/dto/pagination.dto';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { MembersService } from '../members/members.service';
import { MAX_UPLOAD_BYTES, type DocumentEntityType } from './documents.constants';
import {
  DocumentResponseDto,
  type DownloadUrlResponseDto,
  type ListDocumentsQueryDto,
  type PaginatedDocumentsDto,
  type UploadDocumentDto,
} from './documents.dto';
import { detectMimeType } from './file-signature';
import { StorageService } from './storage.service';

const ENTITY_TYPE = 'DOCUMENT';

/** multer decodifica el nombre como latin1; lo devolvemos a UTF-8 y quitamos rutas y caracteres de control. */
function sanitizeFilename(rawName: string): string {
  const utf8 = Buffer.from(rawName, 'latin1').toString('utf8');
  // eslint-disable-next-line no-control-regex
  const cleaned = utf8.replace(/[\\/\u0000-\u001f]/g, '_').trim();
  return (cleaned || 'document').slice(0, 255);
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly members: MembersService,
  ) {}

  async upload(
    file: Express.Multer.File | undefined,
    dto: UploadDocumentDto,
    actor: AuthenticatedUser,
  ): Promise<DocumentResponseDto> {
    if (!file) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Request validation failed',
        [{ field: 'file', messages: ['file is required'] }],
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new AppException(
        HttpStatus.PAYLOAD_TOO_LARGE,
        'PAYLOAD_TOO_LARGE',
        'File is too large',
      );
    }
    if (Boolean(dto.entity_type) !== Boolean(dto.entity_id)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Request validation failed',
        [{ field: 'entity_id', messages: ['entity_type and entity_id must be provided together'] }],
      );
    }
    const mimeType = detectMimeType(file.buffer);
    if (!mimeType) {
      throw new AppException(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'UNSUPPORTED_MEDIA_TYPE',
        'Unsupported file type. Allowed: PDF, JPEG, PNG, WebP',
      );
    }
    if (dto.entity_type && dto.entity_id) {
      await this.assertEntityExists(dto.entity_type, dto.entity_id);
    }

    // El nombre original nunca forma parte de la clave: evita colisiones y path traversal.
    const storageKey = `documents/${new Date().getUTCFullYear()}/${randomUUID()}`;
    await this.storage.put(storageKey, file.buffer, mimeType);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.document.create({
          data: {
            storageKey,
            originalFilename: sanitizeFilename(file.originalname),
            mimeType,
            sizeBytes: file.size,
            sha256: createHash('sha256').update(file.buffer).digest('hex'),
            category: dto.category,
            entityType: dto.entity_type ?? null,
            entityId: dto.entity_id ?? null,
            uploadedById: actor.id,
          },
        });
        await this.audit.record(
          {
            action: 'documents.uploaded',
            entityType: ENTITY_TYPE,
            entityId: row.id,
            after: DocumentResponseDto.from(row),
          },
          tx,
        );
        return row;
      });
      return DocumentResponseDto.from(created);
    } catch (error) {
      await this.storage.remove(storageKey).catch((cleanupError: unknown) => {
        this.logger.warn(`Could not remove orphaned object ${storageKey}: ${String(cleanupError)}`);
      });
      throw error;
    }
  }

  async list(query: ListDocumentsQueryDto): Promise<PaginatedDocumentsDto> {
    const where: Prisma.DocumentWhereInput = {
      deletedAt: null,
      entityType: query.entity_type,
      entityId: query.entity_id,
      category: query.category,
    };
    const [rows, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(query),
      }),
      this.prisma.document.count({ where }),
    ]);
    return {
      data: rows.map((row) => DocumentResponseDto.from(row)),
      meta: paginationMeta(query, total),
    };
  }

  async findOneOrFail(id: string): Promise<DocumentResponseDto> {
    return DocumentResponseDto.from(await this.findRowOrFail(id));
  }

  async createDownloadUrl(id: string): Promise<DownloadUrlResponseDto> {
    const document = await this.findRowOrFail(id);
    const { url, expiresAt } = await this.storage.presignDownload(
      document.storageKey,
      document.originalFilename,
    );
    await this.audit.record({
      action: 'documents.download_url_issued',
      entityType: ENTITY_TYPE,
      entityId: id,
      metadata: { expires_at: expiresAt.toISOString() },
    });
    return { url, expires_at: expiresAt.toISOString() };
  }

  /** Borrado lógico. El objeto en el bucket se purga en un job de retención (fuera de la Fase 0). */
  async remove(id: string): Promise<void> {
    const before = await this.findRowOrFail(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.document.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(
        {
          action: 'documents.deleted',
          entityType: ENTITY_TYPE,
          entityId: id,
          before: DocumentResponseDto.from(before),
        },
        tx,
      );
    });
  }

  private async findRowOrFail(id: string): Promise<Document> {
    const document = await this.prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!document) throw new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Document not found');
    return document;
  }

  private async assertEntityExists(
    entityType: DocumentEntityType,
    entityId: string,
  ): Promise<void> {
    switch (entityType) {
      case 'MEMBER':
        await this.members.assertExists(entityId);
        return;
    }
  }
}
