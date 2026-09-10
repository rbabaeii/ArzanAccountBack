import { Controller, Get, Put, Post, Body, Query } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CurrencySyncService } from './currency-sync.service';
import { ApiResponse } from '../common/dto/api-response.dto';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly currencySyncService: CurrencySyncService,
  ) {}

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
    @Body('maxPurchaseRatioDenominator') maxPurchaseRatioDenominator?: number,
    @Body('purchaseRatioExemptionThreshold') purchaseRatioExemptionThreshold?: number,
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
    if (maxPurchaseRatioDenominator !== undefined) {
      await this.settingsService.updateSetting(
        'MAX_PURCHASE_RATIO_DENOMINATOR',
        maxPurchaseRatioDenominator.toString(),
        user,
      );
    }
    if (purchaseRatioExemptionThreshold !== undefined) {
      await this.settingsService.updateSetting(
        'PURCHASE_RATIO_EXEMPTION_THRESHOLD',
        purchaseRatioExemptionThreshold.toString(),
        user,
      );
    }
    const updated = await this.settingsService.getAllSettings();
    return ApiResponse.success(updated, 'تنظیمات با موفقیت ذخیره شد.');
  }

  /**
   * Manual trigger: immediately query BrsApi and update USD rate.
   */
  @Post('currency/sync-now')
  async syncCurrencyNow(@Body('user') user?: string) {
    const result = await this.currencySyncService.syncUsdRate(
      user || 'مدیر سیستم (استعلام دستی)',
    );
    const settings = await this.settingsService.getAllSettings();
    return ApiResponse.success({ ...result, settings }, result.message);
  }

  /**
   * Update currency sync configurations (API key, interval, auto-sync).
   */
  @Put('currency/sync-config')
  async updateCurrencySyncConfig(
    @Body('apiKey') apiKey?: string,
    @Body('intervalMinutes') intervalMinutes?: number,
    @Body('enableAutoSync') enableAutoSync?: boolean,
    @Body('user') user?: string,
  ) {
    const config = await this.currencySyncService.updateCurrencySyncConfig({
      apiKey,
      intervalMinutes,
      enableAutoSync,
      user,
    });
    const settings = await this.settingsService.getAllSettings();
    return ApiResponse.success(
      { config, settings },
      'تنظیمات وب‌سرویس استعلام خودکار دلار با موفقیت ذخیره شد.',
    );
  }

  /**
   * Get current currency sync status.
   */
  @Get('currency/sync-status')
  async getCurrencySyncStatus() {
    const config = await this.currencySyncService.getCurrencySyncConfig();
    return ApiResponse.success(config);
  }

  @Get('logs')
  async getLogs(@Query('limit') limit?: string) {
    const logs = await this.settingsService.getAuditLogs(limit ? Number(limit) : 50);
    return ApiResponse.success(logs);
  }
}
