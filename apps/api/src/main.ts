import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AppModule } from './app.module';
import { DatabaseService } from './database.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  // API routes live under /api so they never collide with frontend routing.
  app.setGlobalPrefix('api');

  const webDist = resolve(
    process.env.WEB_DIST_DIR ?? join(__dirname, '..', '..', 'web', 'dist'),
  );
  const indexHtml = join(webDist, 'index.html');

  if (existsSync(indexHtml)) {
    app.useStaticAssets(webDist, { index: false });
    app.use((request: Request, response: Response, next: NextFunction) => {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        next();
        return;
      }
      if (request.path.startsWith('/api') || request.path.includes('.')) {
        next();
        return;
      }
      response.sendFile(indexHtml);
    });
  } else {
    logger.warn(`Frontend build not found at ${webDist}; serving API only`);
  }

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  const database = app.get(DatabaseService);
  logger.log(`Listening on http://localhost:${port}`);
  logger.log(`SQLite database: ${database.databasePath}`);
}

void bootstrap();
