import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { CartBeCartClientService } from './cartbecart-client.service';
import { CartBeCartService } from './cartbecart.service';
import { CartBeCartController } from './cartbecart.controller';

import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    OrdersModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'arzan-account-secret-key-2026',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [CartBeCartController],
  providers: [CartBeCartClientService, CartBeCartService],
  exports: [CartBeCartService, CartBeCartClientService],
})
export class CartBeCartModule {}
