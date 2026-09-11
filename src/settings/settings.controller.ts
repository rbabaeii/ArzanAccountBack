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
    @Body('orderCashbackPercent') orderCashbackPercent?: number,
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
    if (orderCashbackPercent !== undefined) {
      await this.settingsService.updateSetting(
        'ORDER_CASHBACK_PERCENT',
        Math.max(0, Math.min(100, orderCashbackPercent)).toString(),
        user,
      );
    }
    const updated = await this.settingsService.getAllSettings();
    return ApiResponse.success(updated, 'تنظیمات با موفقیت ذخیره شد.');
  }

  @Put('branding')
  async updateBranding(
    @Body('siteLogo') siteLogo?: string,
    @Body('siteLogoDark') siteLogoDark?: string,
    @Body('siteFavicon') siteFavicon?: string,
    @Body('siteName') siteName?: string,
    @Body('siteTagline') siteTagline?: string,
    @Body('siteDescription') siteDescription?: string,
    @Body('sitePhone') sitePhone?: string,
    @Body('siteEmail') siteEmail?: string,
    @Body('supportTelegram') supportTelegram?: string,
    @Body('siteInstagram') siteInstagram?: string,
    @Body('siteEnamad') siteEnamad?: string,
    @Body('user') user = 'مدیر سیستم',
  ) {
    if (siteLogo !== undefined) await this.settingsService.updateSetting('SITE_LOGO_URL', siteLogo, user);
    if (siteLogoDark !== undefined) await this.settingsService.updateSetting('SITE_LOGO_DARK_URL', siteLogoDark, user);
    if (siteFavicon !== undefined) await this.settingsService.updateSetting('SITE_FAVICON_URL', siteFavicon, user);
    if (siteName !== undefined) await this.settingsService.updateSetting('SITE_NAME', siteName, user);
    if (siteTagline !== undefined) await this.settingsService.updateSetting('SITE_TAGLINE', siteTagline, user);
    if (siteDescription !== undefined) await this.settingsService.updateSetting('SITE_DESCRIPTION', siteDescription, user);
    if (sitePhone !== undefined) await this.settingsService.updateSetting('SITE_PHONE', sitePhone, user);
    if (siteEmail !== undefined) await this.settingsService.updateSetting('SITE_EMAIL', siteEmail, user);
    if (supportTelegram !== undefined) await this.settingsService.updateSetting('SUPPORT_TELEGRAM', supportTelegram, user);
    if (siteInstagram !== undefined) await this.settingsService.updateSetting('SITE_INSTAGRAM', siteInstagram, user);
    if (siteEnamad !== undefined) await this.settingsService.updateSetting('SITE_ENAMAD_CODE', siteEnamad, user);

    const updated = await this.settingsService.getAllSettings();
    return ApiResponse.success(updated, 'تنظیمات برندینگ و مشخصات بصری سایت با موفقیت ذخیره شد.');
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
