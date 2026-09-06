import { Controller, Get, Put, Body, Query } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { ApiResponse } from '../common/dto/api-response.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings() {
    const data = await this.settingsService.getAllSettings();
    return ApiResponse.success(data);
  }

  @Put('currency')
  async updateCurrency(
    @Body('usdToRialRate') usdToRialRate?: number,
    @Body('rate') rate?: number,
    @Body('defaultMarginPercent') defaultMarginPercent?: number,
    @Body('margin') margin?: number,
    @Body('user') user?: string,
  ) {
    const finalRate = usdToRialRate || rate;
    const finalMargin = defaultMarginPercent !== undefined ? defaultMarginPercent : margin;

    if (finalRate) {
      await this.settingsService.updateSetting('USD_TO_RIAL_RATE', finalRate.toString(), user);
    }
    if (finalMargin !== undefined) {
      await this.settingsService.updateSetting(
        'DEFAULT_MARGIN_PERCENT',
        finalMargin.toString(),
        user,
      );
    }
    const updated = await this.settingsService.getAllSettings();
    return ApiResponse.success(updated, 'نرخ ارز و حاشیه سود با موفقیت ذخیره شد.');
  }

  @Get('logs')
  async getLogs(@Query('limit') limit?: string) {
    const logs = await this.settingsService.getAuditLogs(limit ? Number(limit) : 50);
    return ApiResponse.success(logs);
  }
}
