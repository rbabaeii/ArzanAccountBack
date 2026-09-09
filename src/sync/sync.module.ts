import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { IrMarketModule } from '../irmarket/irmarket.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [IrMarketModule, SearchModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
