export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** Tipos de entidad a los que se puede vincular un documento. Cada módulo nuevo añade el suyo aquí. */
export const DOCUMENT_ENTITY_TYPES = ['MEMBER'] as const;
export type DocumentEntityType = (typeof DOCUMENT_ENTITY_TYPES)[number];
