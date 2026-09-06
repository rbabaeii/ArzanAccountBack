import { Module } from '@nestjs/common';
import { IrMarketService } from './irmarket.service';
import { IrMarketController } from './irmarket.controller';

@Module({
  controllers: [IrMarketController],
  providers: [IrMarketService],
  exports: [IrMarketService],
})
export class IrMarketModule {}
