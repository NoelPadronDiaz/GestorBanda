import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { Public } from '../modules/auth/decorators/public.decorator';

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: 'ok' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'INTERNAL_ERROR',
        'Database is not reachable',
      );
    }
    return { status: 'ok' };
  }
}
