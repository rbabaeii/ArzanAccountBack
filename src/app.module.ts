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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    IrMarketModule,
    SyncModule,
    CatalogModule,
    PricingModule,
    SettingsModule,
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
