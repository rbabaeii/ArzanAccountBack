import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CurrencySyncService } from './currency-sync.service';
import { ApiResponse } from '../common/dto/api-response.dto';
import {
  UpdateCurrencyDto,
  UpdateBrandingDto,
  SyncCurrencyNowDto,
  UpdateCurrencySyncConfigDto,
} from './settings.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
  @Put('currency')
  async updateCurrency(
    @Body() dto: UpdateCurrencyDto,
    @CurrentUser('name') userName?: string,
  ) {
    const {
      usdToRialRate,
      rate,
      defaultMarginPercent,
      margin,
      maxPurchaseRatioDenominator,
      purchaseRatioExemptionThreshold,
      orderCashbackPercent,
    } = dto;
    const finalRate = usdToRialRate || rate;
    const finalMargin = defaultMarginPercent !== undefined ? defaultMarginPercent : margin;
    const user = userName || dto.user || 'مدیر مالی';

    if (finalRate !== undefined) {
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Put('branding')
  async updateBranding(
    @Body() dto: UpdateBrandingDto,
    @CurrentUser('name') userName?: string,
  ) {
    const {
      siteLogo,
      siteLogoDark,
      siteFavicon,
      siteName,
      siteTagline,
      siteDescription,
      sitePhone,
      siteEmail,
      supportTelegram,
      siteInstagram,
      siteEnamad,
    } = dto;
    const user = userName || dto.user || 'مدیر ارشد';

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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
  @Post('currency/sync-now')
  async syncCurrencyNow(
    @Body() dto: SyncCurrencyNowDto,
    @CurrentUser('name') userName?: string,
  ) {
    const result = await this.currencySyncService.syncUsdRate(
      userName || dto.user || 'مدیر مالی (استعلام دستی)',
    );
    const settings = await this.settingsService.getAllSettings();
    return ApiResponse.success({ ...result, settings }, result.message);
  }

  /**
   * Update currency sync configurations (API key, interval, auto-sync).
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
  @Put('currency/sync-config')
  async updateCurrencySyncConfig(
    @Body() dto: UpdateCurrencySyncConfigDto,
    @CurrentUser('name') userName?: string,
  ) {
    const config = await this.currencySyncService.updateCurrencySyncConfig({
      apiKey: dto.apiKey,
      intervalMinutes: dto.intervalMinutes,
      enableAutoSync: dto.enableAutoSync,
      user: userName || dto.user,
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
  @Get('currency/sync-status')
  async getCurrencySyncStatus() {
    const config = await this.currencySyncService.getCurrencySyncConfig();
    return ApiResponse.success(config);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Get('logs')
  async getLogs(@Query('limit') limit?: string) {
    const logs = await this.settingsService.getAuditLogs(limit ? Number(limit) : 50);
    return ApiResponse.success(logs);
  }
}
