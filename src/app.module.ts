import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { IrMarketModule } from './irmarket/irmarket.module';
import { SyncModule } from './sync/sync.module';
import { CatalogModule } from './catalog/catalog.module';
import { PricingModule } from './pricing/pricing.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MediaModule } from './media/media.module';
import { EmailModule } from './email/email.module';
import { OrdersModule } from './orders/orders.module';
import { SearchModule } from './search/search.module';
import { RedisModule } from './redis/redis.module';
import { CartBeCartModule } from './cartbecart/cartbecart.module';
import { SmsModule } from './sms/sms.module';
import { CouponsModule } from './coupons/coupons.module';

import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 60,
      },
    ]),
    PrismaModule,
    IrMarketModule,
    SyncModule,
    CatalogModule,
    PricingModule,
    SettingsModule,
    UsersModule,
    AuthModule,
    MediaModule,
    EmailModule,
    SmsModule,
    OrdersModule,
    SearchModule,
    RedisModule,
    CartBeCartModule,
    CouponsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
