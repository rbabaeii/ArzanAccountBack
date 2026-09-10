import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CurrencySyncService } from './currency-sync.service';
import { SettingsController } from './settings.controller';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, CurrencySyncService],
  exports: [SettingsService, CurrencySyncService],
})
export class SettingsModule {}
