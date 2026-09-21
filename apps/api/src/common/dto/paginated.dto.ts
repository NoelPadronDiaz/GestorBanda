import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from './pagination.dto';

/** Base de las respuestas paginadas: cada módulo la extiende añadiendo `data` tipado. */
export abstract class PaginatedMetaHolder {
  @ApiProperty({ type: PaginationMetaDto }) meta!: PaginationMetaDto;
}
