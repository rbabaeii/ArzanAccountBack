import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global Prefix
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS for Next.js Storefront & Admin
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);

  logger.log(`🚀 arzanAccount Backend Gateway running at: http://localhost:${port}/api/v1`);
  logger.log(`📦 irMarket API Client initialized with base: https://api.irmarket.store`);
  logger.log(`🔒 Mock Purchase Guard: ${process.env.MOCK_PURCHASE === 'false' ? 'DISABLED ⚠️' : 'ACTIVE 🛡️'}`);
}

bootstrap();
