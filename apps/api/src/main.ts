import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { API_PREFIX } from './app.constants';
import { createValidationPipe } from './common/pipes/validation.pipe';
import type { Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  const swaggerEnabled =
    config.get('SWAGGER_ENABLED', { infer: true }) ??
    config.get('NODE_ENV', { infer: true }) !== 'production';

  app.setGlobalPrefix(API_PREFIX);
  if (config.get('TRUST_PROXY', { infer: true })) app.set('trust proxy', 1);

  // La API solo sirve JSON; la CSP se relaja únicamente para que funcione Swagger UI.
  app.use(helmet({ contentSecurityPolicy: swaggerEnabled ? false : undefined }));
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
    exposedHeaders: ['x-trace-id'],
  });
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();

  if (swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('ALCARAVAN-APP API')
        .setDescription('Gestión integral de una banda de música (single tenant).')
        .setVersion('0.1.0')
        .addBearerAuth()
        .addCookieAuth('refresh_token')
        .build(),
    );
    SwaggerModule.setup('docs', app, document, { useGlobalPrefix: true });
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
  Logger.log(
    `API listening on :${port}/${API_PREFIX}${swaggerEnabled ? ' (docs at /docs)' : ''}`,
    'Bootstrap',
  );
}

void bootstrap();
