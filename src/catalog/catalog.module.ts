import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { PricingModule } from '../pricing/pricing.module';
import { IrMarketModule } from '../irmarket/irmarket.module';
import { SearchModule } from '../search/search.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    PricingModule,
    IrMarketModule,
    SearchModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'arzan-account-secret-key-2026',
      signOptions: { expiresIn: '30d' },
    }),
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
