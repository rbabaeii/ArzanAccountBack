import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import express, { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const server = express();
let isInitialized = false;

function setupVercelDatabase() {
  if (process.env.VERCEL) {
    const tmpDbPath = '/tmp/dev.db';
    if (!fs.existsSync(tmpDbPath)) {
      const candidates = [
        path.join(process.cwd(), 'prisma', 'dev.db'),
        path.join(__dirname, '..', 'prisma', 'dev.db'),
        path.join(__dirname, 'prisma', 'dev.db'),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          try {
            fs.copyFileSync(candidate, tmpDbPath);
            console.log(`[VERCEL] Successfully copied initial dev.db from ${candidate} to ${tmpDbPath}`);
            break;
          } catch (e: any) {
            console.error('[VERCEL] Error copying dev.db to /tmp:', e?.message);
          }
        }
      }
    }
    process.env.DATABASE_URL = 'file:/tmp/dev.db';
  }
}

async function bootstrap(): Promise<express.Express> {
  setupVercelDatabase();

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

  // Global prefix matching Next.js rewrites and frontend calls
  app.setGlobalPrefix('api/v1');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    process.env.FRONTEND_URL,
    process.env.SITE_PUBLIC_URL,
  ].filter(Boolean) as string[];

  // Secure CORS whitelist for Serverless deployment
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      // Check explicit allowed origins list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow verified Vercel preview deployments (*.vercel.app)
      if (/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error('CORS request blocked by security policy.'), false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.init();
  return server;
}

export default async function handler(req: Request, res: Response) {
  if (!isInitialized) {
    await bootstrap();
    isInitialized = true;
  }
  server(req, res);
}
