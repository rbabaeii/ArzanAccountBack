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

    const maxPurchaseRatioDenominator = parseInt(map['MAX_PURCHASE_RATIO_DENOMINATOR'] || '3', 10);
    const purchaseRatioExemptionThreshold = parseInt(map['PURCHASE_RATIO_EXEMPTION_THRESHOLD'] || '10', 10);
    const currencyApiKey = map['CURRENCY_API_KEY'] || process.env.CURRENCY_API_KEY || '';
    const currencySyncIntervalMinutes = parseInt(map['CURRENCY_SYNC_INTERVAL_MINUTES'] || '15', 10);
    const enableCurrencyAutoSync = map['CURRENCY_AUTO_SYNC_ENABLED'] !== 'false';
    const lastCurrencySyncTime = map['LAST_CURRENCY_SYNC_TIME'] || 'هنوز استعلام نشده';
    const lastCurrencyPriceToman = parseInt(map['LAST_CURRENCY_PRICE_TOMAN'] || '0', 10) || Math.round(usdToRialRate / 10);
    const lastCurrencyChangePercent = parseFloat(map['LAST_CURRENCY_CHANGE_PERCENT'] || '0');
    const orderCashbackPercent = parseInt(map['ORDER_CASHBACK_PERCENT'] || '10', 10);

    return {
      usdToRialRate,
      usdToTomanRate: Math.round(usdToRialRate / 10),
      defaultMarginPercent,
      walletBalanceUsd,
      lastSyncTime,
      siteName: map['SITE_NAME'] || 'ارزان اکانت (arzanAccount)',
      siteTagline: map['SITE_TAGLINE'] || 'مرجع تخصصی خرید انواع اکانت و اشتراک‌های بین‌المللی با تحویل فوری',
      siteDescription: map['SITE_DESCRIPTION'] || 'خرید اشتراک پریمیوم اسپاتیفای، چت جی پی تی، نتفلیکس، اپل موزیک و سرویس‌های هوش مصنوعی با کمترین قیمت و ضمانت رسمی.',
      siteLogo: map['SITE_LOGO_URL'] || '',
      siteLogoDark: map['SITE_LOGO_DARK_URL'] || '',
      siteFavicon: map['SITE_FAVICON_URL'] || '',
      sitePhone: map['SITE_PHONE'] || '۰۲۱-۸۸۸۸۴۳۲۱',
      siteEmail: map['SITE_EMAIL'] || 'support@arzanaccount.com',
      supportTelegram: map['SUPPORT_TELEGRAM'] || '@arzan_support',
      siteInstagram: map['SITE_INSTAGRAM'] || 'arzanaccount_official',
      siteEnamad: map['SITE_ENAMAD_CODE'] || '',
      maxPurchaseRatioDenominator,
      purchaseRatioExemptionThreshold,
      orderCashbackPercent: isNaN(orderCashbackPercent) || orderCashbackPercent < 0 ? 10 : orderCashbackPercent,
      currencyApiKey: currencyApiKey ? '••••••••' + (currencyApiKey.length > 4 ? currencyApiKey.slice(-4) : '') : '',
      currencySyncIntervalMinutes: isNaN(currencySyncIntervalMinutes) || currencySyncIntervalMinutes < 1 ? 15 : currencySyncIntervalMinutes,
      enableCurrencyAutoSync,
      lastCurrencySyncTime,
      lastCurrencyPriceToman,
      lastCurrencyChangePercent,
    };
  }

  async getPublicSettings() {
    const settings = await this.prisma.systemSetting.findMany();
    const map: Record<string, string> = {};
    settings.forEach((s) => {
      map[s.key] = s.value;
    });

    const usdToRialRate = parseInt(map['USD_TO_RIAL_RATE'] || '720000', 10);
    const lastSyncTime = map['LAST_SYNC_TIME'] || 'هم‌اکنون';

    return {
      usdToRialRate,
      usdToTomanRate: Math.round(usdToRialRate / 10),
      lastSyncTime,
      siteName: map['SITE_NAME'] || 'ارزان اکانت (arzanAccount)',
      siteTagline: map['SITE_TAGLINE'] || 'مرجع تخصصی خرید انواع اکانت و اشتراک‌های بین‌المللی با تحویل فوری',
      siteDescription: map['SITE_DESCRIPTION'] || 'خرید اشتراک پریمیوم اسپاتیفای، چت جی پی تی، نتفلیکس، اپل موزیک و سرویس‌های هوش مصنوعی با کمترین قیمت و ضمانت رسمی.',
      siteLogo: map['SITE_LOGO_URL'] || '',
      siteLogoDark: map['SITE_LOGO_DARK_URL'] || '',
      siteFavicon: map['SITE_FAVICON_URL'] || '',
      sitePhone: map['SITE_PHONE'] || '۰۲۱-۸۸۸۸۴۳۲۱',
      siteEmail: map['SITE_EMAIL'] || 'support@arzanaccount.com',
      supportTelegram: map['SUPPORT_TELEGRAM'] || '@arzan_support',
      siteInstagram: map['SITE_INSTAGRAM'] || 'arzanaccount_official',
      siteEnamad: map['SITE_ENAMAD_CODE'] || '',
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
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    });
  }
}
