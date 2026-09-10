import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllSettings() {
    const settings = await this.prisma.systemSetting.findMany();
    const map: Record<string, string> = {};
    settings.forEach((s) => {
      map[s.key] = s.value;
    });

    const usdToRialRate = parseInt(map['USD_TO_RIAL_RATE'] || '720000', 10);
    const defaultMarginPercent = parseInt(map['DEFAULT_MARGIN_PERCENT'] || '15', 10);
    const walletBalanceUsd = parseFloat(map['WALLET_BALANCE_USD'] || '0.30');
    const lastSyncTime = map['LAST_SYNC_TIME'] || 'هم‌اکنون';

    const currencyApiKey = map['CURRENCY_API_KEY'] || 'BNrVb9bLT9dLPpgY4UDvX8bqJTvEaqKw';
    const currencySyncIntervalMinutes = parseInt(map['CURRENCY_SYNC_INTERVAL_MINUTES'] || '15', 10);
    const enableCurrencyAutoSync = map['CURRENCY_AUTO_SYNC_ENABLED'] !== 'false';
    const lastCurrencySyncTime = map['LAST_CURRENCY_SYNC_TIME'] || 'هنوز استعلام نشده';
    const lastCurrencyPriceToman = parseInt(map['LAST_CURRENCY_PRICE_TOMAN'] || '0', 10) || Math.round(usdToRialRate / 10);
    const lastCurrencyChangePercent = parseFloat(map['LAST_CURRENCY_CHANGE_PERCENT'] || '0');

    return {
      usdToRialRate,
      usdToTomanRate: Math.round(usdToRialRate / 10),
      defaultMarginPercent,
      walletBalanceUsd,
      lastSyncTime,
      siteName: map['SITE_NAME'] || 'ارزان اکانت (arzanAccount)',
      supportTelegram: map['SUPPORT_TELEGRAM'] || '@arzan_support',
      currencyApiKey,
      currencySyncIntervalMinutes: isNaN(currencySyncIntervalMinutes) || currencySyncIntervalMinutes < 1 ? 15 : currencySyncIntervalMinutes,
      enableCurrencyAutoSync,
      lastCurrencySyncTime,
      lastCurrencyPriceToman,
      lastCurrencyChangePercent,
    };
  }

  async updateSetting(key: string, value: string, user = 'مدیر سیستم') {
    const prev = await this.prisma.systemSetting.findUnique({ where: { key } });

    const updated = await this.prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    // Record in audit log if key is rate or margin
    if (key === 'USD_TO_RIAL_RATE' && (!prev || prev.value !== value)) {
      const formattedRate = new Intl.NumberFormat('fa-IR').format(parseInt(value, 10));
      await this.prisma.auditLog.create({
        data: {
          action: 'تغییر نرخ برابری دلار به ریال',
          details: `نرخ پایه دلار به ${formattedRate} ریال تغییر یافت.`,
          user,
          type: 'rate_change',
        },
      });
    }

    return updated;
  }

  async getAuditLogs(limit = 50) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
