import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from './settings.service';

export interface BrsApiCurrencyItem {
  date?: string;
  time?: string;
  time_unix?: number;
  symbol: string;
  name_en?: string;
  name?: string;
  price: number | string;
  change_value?: number;
  change_percent?: number;
  unit?: string;
}

export interface BrsApiResponse {
  gold?: any[];
  currency?: BrsApiCurrencyItem[];
  cryptocurrency?: any[];
}

@Injectable()
export class CurrencySyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CurrencySyncService.name);
  private isSyncing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async onApplicationBootstrap() {
    // Delay initial sync by 4 seconds after application starts
    setTimeout(() => {
      this.syncUsdRate('سیستم خودکار راه‌اندازی').catch((err) => {
        this.logger.warn(`Initial currency sync failed: ${err?.message || err}`);
      });
    }, 4000);
  }

  /**
   * Periodic check running every 60 seconds.
   * Checks if elapsed time exceeds the configured interval in minutes.
   */
  @Interval(60000)
  async handlePeriodicSync() {
    try {
      const config = await this.getCurrencySyncConfig();
      if (!config.isAutoSyncEnabled) {
        return;
      }

      const intervalMs = Math.max(1, config.intervalMinutes) * 60 * 1000;
      const now = Date.now();
      const elapsed = now - config.lastSyncTimestamp;

      if (elapsed >= intervalMs) {
        this.logger.log(
          `Periodic currency sync triggered (${Math.round(elapsed / 60000)}m elapsed, target: ${config.intervalMinutes}m).`,
        );
        await this.syncUsdRate('سیستم زمان‌بندی خودکار');
      }
    } catch (error) {
      this.logger.error('Error during periodic currency sync check:', error);
    }
  }

  /**
   * Fetches the latest USD price from BrsApi, multiplies by 10 for Rials, and persists.
   */
  async syncUsdRate(triggeredBy = 'مدیر سیستم') {
    if (this.isSyncing) {
      return {
        success: false,
        message: 'استعلام دیگری در حال انجام است. لطفاً چند لحظه شکیبا باشید.',
      };
    }

    this.isSyncing = true;
    try {
      const config = await this.getCurrencySyncConfig();
      const apiKey = config.apiKey || 'BNrVb9bLT9dLPpgY4UDvX8bqJTvEaqKw';
      const url = `https://Api.BrsApi.ir/Market/Gold_Currency.php?key=${encodeURIComponent(apiKey)}`;

      this.logger.log(`Fetching live USD exchange rate from BrsApi...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'arzanAccount-CurrencySync/1.0',
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        throw new Error(`خطای وب‌سرویس BrsApi [${response.status}]`);
      }

      const data: BrsApiResponse = await response.json();
      if (!data || !Array.isArray(data.currency)) {
        throw new Error('فرمت پاسخ وب‌سرویس BrsApi نامعتبر است (آرایه currency یافت نشد).');
      }

      const usdItem = data.currency.find(
        (item) => item.symbol?.trim().toUpperCase() === 'USD',
      );

      if (!usdItem) {
        throw new Error('نماد USD در داده‌های بازگشتی وب‌سرویس ارز یافت نشد.');
      }

      const priceToman = typeof usdItem.price === 'number'
        ? usdItem.price
        : parseFloat(usdItem.price.toString().replace(/,/g, ''));

      if (isNaN(priceToman) || priceToman <= 0) {
        throw new Error(`قیمت نامعتبر برای دلار: ${usdItem.price}`);
      }

      // Per requirements: price is in Toman, multiply by 10 to get Rials for usdToRialRate
      const usdToRialRate = Math.round(priceToman * 10);
      const nowFormatted = this.formatSyncTime(usdItem.date, usdItem.time);

      // 1. Update system settings
      await this.settingsService.updateSetting('USD_TO_RIAL_RATE', usdToRialRate.toString(), triggeredBy);
      await this.settingsService.updateSetting('LAST_CURRENCY_SYNC_TIME', nowFormatted, triggeredBy);
      await this.settingsService.updateSetting('LAST_CURRENCY_PRICE_TOMAN', priceToman.toString(), triggeredBy);
      await this.settingsService.updateSetting(
        'LAST_CURRENCY_CHANGE_VALUE',
        (usdItem.change_value ?? 0).toString(),
        triggeredBy,
      );
      await this.settingsService.updateSetting(
        'LAST_CURRENCY_CHANGE_PERCENT',
        (usdItem.change_percent ?? 0).toString(),
        triggeredBy,
      );
      await this.settingsService.updateSetting(
        'LAST_CURRENCY_SYNC_TIMESTAMP',
        Date.now().toString(),
        triggeredBy,
      );

      // 2. Record audit log
      const formattedToman = new Intl.NumberFormat('fa-IR').format(priceToman);
      const formattedRial = new Intl.NumberFormat('fa-IR').format(usdToRialRate);
      const changeSign = (usdItem.change_percent ?? 0) >= 0 ? '+' : '';

      await this.prisma.auditLog.create({
        data: {
          action: 'استعلام خودکار نرخ ارز از BrsApi',
          details: `نرخ دلار با موفقیت از BrsApi بروزرسانی شد: ${formattedToman} تومان (${formattedRial} ریال). نوسان: ${changeSign}${usdItem.change_percent ?? 0}%`,
          user: triggeredBy,
          type: 'rate_change',
        },
      });

      this.logger.log(
        `USD rate synchronized: ${priceToman} Toman (${usdToRialRate} Rial), change: ${usdItem.change_percent}%`,
      );

      return {
        success: true,
        priceToman,
        usdToRialRate,
        changeValue: usdItem.change_value ?? 0,
        changePercent: usdItem.change_percent ?? 0,
        syncTime: nowFormatted,
        message: `نرخ دلار با موفقیت از وب‌سرویس استعلام شد: ${formattedToman} تومان.`,
      };
    } catch (error) {
      this.logger.error('Failed to sync USD rate:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Retrieves all currency sync configurations and status.
   */
  async getCurrencySyncConfig() {
    const settings = await this.prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'CURRENCY_API_KEY',
            'CURRENCY_SYNC_INTERVAL_MINUTES',
            'CURRENCY_AUTO_SYNC_ENABLED',
            'LAST_CURRENCY_SYNC_TIME',
            'LAST_CURRENCY_PRICE_TOMAN',
            'LAST_CURRENCY_CHANGE_VALUE',
            'LAST_CURRENCY_CHANGE_PERCENT',
            'LAST_CURRENCY_SYNC_TIMESTAMP',
            'USD_TO_RIAL_RATE',
          ],
        },
      },
    });

    const map: Record<string, string> = {};
    settings.forEach((s) => {
      map[s.key] = s.value;
    });

    const apiKey = map['CURRENCY_API_KEY'] || 'BNrVb9bLT9dLPpgY4UDvX8bqJTvEaqKw';
    const intervalMinutes = parseInt(map['CURRENCY_SYNC_INTERVAL_MINUTES'] || '15', 10);
    const isAutoSyncEnabled = map['CURRENCY_AUTO_SYNC_ENABLED'] !== 'false';
    const lastSyncTime = map['LAST_CURRENCY_SYNC_TIME'] || 'هنوز استعلام نشده';
    const lastPriceToman = parseInt(map['LAST_CURRENCY_PRICE_TOMAN'] || '0', 10);
    const lastChangeValue = parseFloat(map['LAST_CURRENCY_CHANGE_VALUE'] || '0');
    const lastChangePercent = parseFloat(map['LAST_CURRENCY_CHANGE_PERCENT'] || '0');
    const lastSyncTimestamp = parseInt(map['LAST_CURRENCY_SYNC_TIMESTAMP'] || '0', 10);
    const usdToRialRate = parseInt(map['USD_TO_RIAL_RATE'] || '720000', 10);

    return {
      apiKey,
      intervalMinutes: isNaN(intervalMinutes) || intervalMinutes < 1 ? 15 : intervalMinutes,
      isAutoSyncEnabled,
      lastSyncTime,
      lastPriceToman: lastPriceToman || Math.round(usdToRialRate / 10),
      lastChangeValue,
      lastChangePercent,
      lastSyncTimestamp,
      usdToRialRate,
    };
  }

  /**
   * Updates currency sync configuration (API key, interval, auto-sync toggle).
   */
  async updateCurrencySyncConfig(data: {
    apiKey?: string;
    intervalMinutes?: number;
    enableAutoSync?: boolean;
    user?: string;
  }) {
    const user = data.user || 'مدیر سیستم';

    if (data.apiKey !== undefined && data.apiKey.trim()) {
      await this.settingsService.updateSetting('CURRENCY_API_KEY', data.apiKey.trim(), user);
    }

    if (data.intervalMinutes !== undefined) {
      const minutes = Math.max(1, Math.min(1440, data.intervalMinutes));
      await this.settingsService.updateSetting(
        'CURRENCY_SYNC_INTERVAL_MINUTES',
        minutes.toString(),
        user,
      );
    }

    if (data.enableAutoSync !== undefined) {
      await this.settingsService.updateSetting(
        'CURRENCY_AUTO_SYNC_ENABLED',
        data.enableAutoSync ? 'true' : 'false',
        user,
      );
    }

    return this.getCurrencySyncConfig();
  }

  private formatSyncTime(date?: string, time?: string): string {
    if (date && time) {
      return `${date} - ${time}`;
    }
    return new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date());
  }
}
