import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';

/** Cabecera Content-Disposition segura para nombres con acentos o caracteres especiales (RFC 6266 / 5987). */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/**
 * Almacenamiento compatible con S3 (MinIO en local, cualquier proveedor S3 en producción).
 * El bucket es privado: el único acceso de lectura es una URL firmada de corta duración.
 */
@Injectable()
export class StorageService {
  private readonly bucket: string;
  private readonly client: S3Client;
  /** Firma con el endpoint que ve el navegador (distinto del interno cuando hay Docker de por medio). */
  private readonly signer: S3Client;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.bucket = config.get('S3_BUCKET', { infer: true });
    const endpoint = config.get('S3_ENDPOINT', { infer: true });
    const shared = {
      region: config.get('S3_REGION', { infer: true }),
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
      },
    };
    this.client = new S3Client({ ...shared, endpoint });
    this.signer = new S3Client({
      ...shared,
      endpoint: config.get('S3_PUBLIC_ENDPOINT', { infer: true }) ?? endpoint,
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async presignDownload(key: string, filename: string): Promise<{ url: string; expiresAt: Date }> {
    const expiresIn = this.config.get('DOWNLOAD_URL_TTL_SECONDS', { infer: true });
    const url = await getSignedUrl(
      this.signer,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: contentDisposition(filename),
      }),
      { expiresIn },
    );
    return { url, expiresAt: new Date(Date.now() + expiresIn * 1000) };
  }
}
