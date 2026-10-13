import { Module, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import * as crypto from 'crypto';

const logger = new Logger('AuthModule');

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('CRITICAL: JWT_SECRET environment variable is missing in production!');
      throw new Error('FATAL: JWT_SECRET environment variable must be explicitly defined in production.');
    }
    logger.warn('WARNING: JWT_SECRET is unset in development. Generating secure ephemeral key.');
    return 'arzan_dev_secret_' + crypto.randomBytes(16).toString('hex');
  }
  if (secret === 'arzan-account-secret-key-2026' && process.env.NODE_ENV === 'production') {
    logger.warn('SECURITY NOTICE: Default development JWT_SECRET is active in production. Please set a custom high-entropy secret in .env.');
  }
  return secret;
}

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    JwtModule.register({
      global: true,
      secret: getJwtSecret(),
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN as any) || '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
