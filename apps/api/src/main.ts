import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { getEnvironmentConfig } from './config/env.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const config = getEnvironmentConfig();

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret', 'x-request-id'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
  logger.log(`🚀 API backend listening at http://0.0.0.0:${config.port}/api`);
  logger.log(`🏥 Health check at http://localhost:${config.port}/api/health`);
}

bootstrap();
