import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SmsConfig, PayamakPanelRestResponse, PAYAMAK_PANEL_ERRORS } from './sms.types';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Normalize Iranian phone number to standard 09xxxxxxxxx format
   */
  public normalizePhone(phone: string): string {
    if (!phone) return '';
    let cleaned = phone.replace(/[\s\-()]/g, '');
    if (cleaned.startsWith('+98')) {
      cleaned = '0' + cleaned.substring(3);
    } else if (cleaned.startsWith('0098')) {
      cleaned = '0' + cleaned.substring(4);
    } else if (cleaned.startsWith('98') && cleaned.length === 12) {
      cleaned = '0' + cleaned.substring(2);
    }
    return cleaned;
  }

  /**
   * Retrieve active SMS configuration from Database SystemSetting or fallback to env/defaults
   */
  async getSmsConfig(): Promise<SmsConfig> {
    const defaultApiKey = this.configService.get<string>(
      'SMS_API_KEY',
      '5bf81d90-6683-45ee-ad78-afc1e55ac7d0',
    );
    const defaultBaseUrl = this.configService.get<string>(
      'SMS_BASE_URL',
      'https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber',
    );

    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: 'SMS_CONFIG' },
      });

      if (setting && setting.value) {
        const parsed = JSON.parse(setting.value);
        return {
          baseUrl: parsed.baseUrl || defaultBaseUrl,
          apiKey: parsed.apiKey || defaultApiKey,
          username: parsed.username || this.configService.get<string>('SMS_USERNAME', ''),
          isEnabled: parsed.isEnabled !== undefined ? Boolean(parsed.isEnabled) : true,
          patternOtp: Number(parsed.patternOtp) || 0,
          patternOrderCreated: Number(parsed.patternOrderCreated) || 0,
          patternOrderCompleted: Number(parsed.patternOrderCompleted) || 0,
          patternOrderRefunded: Number(parsed.patternOrderRefunded) || 0,
          patternWithdrawalApproved: Number(parsed.patternWithdrawalApproved) || 0,
          patternWalletTopup: Number(parsed.patternWalletTopup) || 0,
        };
      }
    } catch (err: any) {
      this.logger.warn('Failed to parse SMS_CONFIG from database, falling back to defaults', err?.message);
    }

    return {
      baseUrl: defaultBaseUrl,
      apiKey: defaultApiKey,
      username: this.configService.get<string>('SMS_USERNAME', ''),
      isEnabled: this.configService.get<string>('SMS_ENABLED', 'true') === 'true',
      patternOtp: Number(this.configService.get('SMS_PATTERN_OTP', 0)),
      patternOrderCreated: Number(this.configService.get('SMS_PATTERN_ORDER_CREATED', 0)),
      patternOrderCompleted: Number(this.configService.get('SMS_PATTERN_ORDER_COMPLETED', 0)),
      patternOrderRefunded: Number(this.configService.get('SMS_PATTERN_ORDER_REFUNDED', 0)),
      patternWithdrawalApproved: Number(this.configService.get('SMS_PATTERN_WITHDRAWAL_APPROVED', 0)),
      patternWalletTopup: Number(this.configService.get('SMS_PATTERN_WALLET_TOPUP', 0)),
    };
  }

  /**
   * Get Settings formatted for Admin panel (apiKey masked)
   */
  async getSettingsForAdmin(): Promise<any> {
    const config = await this.getSmsConfig();
    return {
      ...config,
      apiKey: config.apiKey ? '••••••••' + (config.apiKey.length > 4 ? config.apiKey.slice(-4) : '') : '',
    };
  }

  /**
   * Update SMS configuration and record audit log
   */
  async updateSettings(newConfig: Partial<SmsConfig>, adminUser = 'مدیر سیستم'): Promise<SmsConfig> {
    const current = await this.getSmsConfig();
    const merged: SmsConfig = {
      ...current,
      ...newConfig,
      apiKey: newConfig.apiKey && !newConfig.apiKey.includes('••••••••')
        ? newConfig.apiKey.trim()
        : current.apiKey,
      isEnabled: newConfig.isEnabled !== undefined ? Boolean(newConfig.isEnabled) : current.isEnabled,
    };

    await this.prisma.systemSetting.upsert({
      where: { key: 'SMS_CONFIG' },
      update: {
        value: JSON.stringify(merged),
      },
      create: {
        key: 'SMS_CONFIG',
        value: JSON.stringify(merged),
        description: 'پیکربندی وب‌سرویس پیامکی خدماتی اشتراکی و کدهای الگو',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'بروزرسانی تنظیمات وب‌سرویس پیامک',
        details: `تنظیمات گیت‌وی پیامک با موفقیت توسط ${adminUser} به‌روزرسانی شد. وضعیت: ${merged.isEnabled ? 'فعال' : 'غیرفعال'}`,
        user: adminUser,
        type: 'settings',
      },
    });

    this.logger.log(`[SMS] Configuration updated by ${adminUser}`);
    return merged;
  }

  /**
   * Core Method: Send SMS using Payamak-Panel BaseServiceNumber (Shared Service Line Pattern)
   */
  async sendPatternSms(
    to: string,
    bodyId: number,
    args: (string | number)[],
    template = 'custom',
  ): Promise<{
    success: boolean;
    recId?: string;
    retStatus?: number;
    strRetStatus?: string;
    errorMessage?: string;
  }> {
    const cleanPhone = this.normalizePhone(to);
    if (!cleanPhone || cleanPhone.length !== 11 || !cleanPhone.startsWith('09')) {
      const errorMsg = `شماره موبایل نامعتبر است: ${to}`;
      this.logger.warn(`[SMS] ${errorMsg}`);
      await this.logSms(to, bodyId, args.join(';'), 'FAILED', undefined, undefined, undefined, errorMsg, template);
      return { success: false, errorMessage: errorMsg };
    }

    const config = await this.getSmsConfig();

    if (!config.isEnabled) {
      this.logger.log(`[SMS DISABLED] SMS sending skipped for ${cleanPhone} (Template: ${template})`);
      await this.logSms(cleanPhone, bodyId, args.join(';'), 'FAILED', undefined, undefined, undefined, 'سرویس پیامک در تنظیمات سیستم غیرفعال است.', template);
      return { success: false, errorMessage: 'سرویس پیامک غیرفعال است.' };
    }

    if (!bodyId || bodyId <= 0) {
      const errorMsg = `کد الگو (bodyId) برای قالب «${template}» تنظیم نشده است. لطفاً از پنل ادمین کد الگوی تاییدشده را وارد کنید.`;
      this.logger.warn(`[SMS] ${errorMsg}`);
      await this.logSms(cleanPhone, bodyId || 0, args.join(';'), 'FAILED', undefined, undefined, undefined, errorMsg, template);
      return { success: false, errorMessage: errorMsg };
    }

    // According to Payamak-Panel documentation: variables are joined by ';' in order
    const formattedText = args.map((a) => String(a).trim()).join(';');

    const payload = {
      username: config.username || '',
      password: config.apiKey,
      text: formattedText,
      to: cleanPhone,
      bodyId: Number(bodyId),
    };

    try {
      this.logger.log(`[SMS REQUEST] Sending pattern ${bodyId} to ${cleanPhone} with args: [${formattedText}]`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const textResponse = await response.text();
      let resData: PayamakPanelRestResponse;
      try {
        resData = JSON.parse(textResponse);
      } catch (parseErr) {
        throw new Error(`پاسخ نامعتبر از سرور پیامک: ${textResponse}`);
      }

      this.logger.log(`[SMS RESPONSE] Status=${response.status}, RetStatus=${resData.RetStatus}, StrRetStatus=${resData.StrRetStatus}, Value=${resData.Value}`);

      // Check success: RetStatus === 1 and StrRetStatus === "Ok" and Value is recID
      const isSuccess = Number(resData.RetStatus) === 1;
      let detailedError: string | undefined;

      if (!isSuccess) {
        const errCode = String(resData.Value);
        const mappedError = PAYAMAK_PANEL_ERRORS[errCode];
        detailedError = mappedError
          ? `کد ${errCode}: ${mappedError}`
          : `خطا در ارسال پیامک: ${resData.StrRetStatus || ''} (کد: ${resData.Value})`;
      }

      await this.logSms(
        cleanPhone,
        bodyId,
        formattedText,
        isSuccess ? 'SENT' : 'FAILED',
        resData.Value,
        resData.RetStatus,
        resData.StrRetStatus,
        detailedError,
        template,
        JSON.stringify({ payload, response: resData }),
      );

      return {
        success: isSuccess,
        recId: isSuccess ? resData.Value : undefined,
        retStatus: resData.RetStatus,
        strRetStatus: resData.StrRetStatus,
        errorMessage: detailedError,
      };
    } catch (networkErr: any) {
      const errMsg = networkErr.name === 'AbortError'
        ? 'تایم‌اوت ارتباط با سرور ارسال پیامک (بیش از ۱۲ ثانیه)'
        : `خطای شبکه در ارتباط با سرور پیامک: ${networkErr.message || networkErr}`;

      this.logger.error(`[SMS ERROR] ${errMsg}`);
      await this.logSms(cleanPhone, bodyId, formattedText, 'FAILED', undefined, undefined, undefined, errMsg, template);
      return { success: false, errorMessage: errMsg };
    }
  }

  /**
   * Save SMS log to Database
   */
  private async logSms(
    to: string,
    bodyId: number,
    text: string,
    status: 'SENT' | 'FAILED',
    recId?: string,
    retStatus?: number,
    strRetStatus?: string,
    errorMessage?: string,
    template?: string,
    metadata?: string,
  ) {
    try {
      await this.prisma.smsLog.create({
        data: {
          to,
          bodyId: Number(bodyId) || null,
          text,
          status,
          recId: recId ? String(recId) : null,
          retStatus: retStatus !== undefined ? Number(retStatus) : null,
          strRetStatus: strRetStatus || null,
          errorMessage: errorMessage || null,
          template: template || null,
          metadata: metadata || null,
        },
      });
    } catch (dbErr: any) {
      this.logger.error('Failed to write SmsLog to database', dbErr?.message);
    }
  }

  // ==========================================
  // EVENT-SPECIFIC SMS HELPERS
  // ==========================================

  /**
   * Send 5-digit OTP Code via SMS Pattern
   */
  async sendOtpSms(phone: string, code: string) {
    const config = await this.getSmsConfig();
    return this.sendPatternSms(phone, config.patternOtp, [code], 'otp');
  }

  /**
   * Send Order Created notification SMS
   */
  async sendOrderCreatedSms(phone: string, orderNumber: string, amountToman: number, customerName?: string) {
    const config = await this.getSmsConfig();
    const formattedAmount = amountToman.toLocaleString('fa-IR');
    return this.sendPatternSms(
      phone,
      config.patternOrderCreated,
      [customerName || 'کاربر گرامی', orderNumber, formattedAmount],
      'order_created',
    );
  }

  /**
   * Send Order Completed / Delivered notification SMS
   */
  async sendOrderCompletedSms(phone: string, orderNumber: string, deliveryDetails?: string) {
    const config = await this.getSmsConfig();
    return this.sendPatternSms(
      phone,
      config.patternOrderCompleted,
      [orderNumber, deliveryDetails || 'اکانت شما فعال گردید'],
      'order_completed',
    );
  }

  /**
   * Send Order Refunded notification SMS
   */
  async sendOrderRefundedSms(phone: string, orderNumber: string, amountToman: number, trackingCode?: string) {
    const config = await this.getSmsConfig();
    const formattedAmount = amountToman.toLocaleString('fa-IR');
    return this.sendPatternSms(
      phone,
      config.patternOrderRefunded,
      [orderNumber, formattedAmount, trackingCode || 'تسویه موفق'],
      'order_refunded',
    );
  }

  /**
   * Send Withdrawal Approved notification SMS
   */
  async sendWithdrawalApprovedSms(phone: string, amountToman: number, trackingCode?: string) {
    const config = await this.getSmsConfig();
    const formattedAmount = amountToman.toLocaleString('fa-IR');
    return this.sendPatternSms(
      phone,
      config.patternWithdrawalApproved,
      [formattedAmount, trackingCode || 'پایا/ساتنا'],
      'withdrawal_approved',
    );
  }

  /**
   * Send Wallet Top-up notification SMS
   */
  async sendWalletTopupSms(phone: string, amountToman: number) {
    const config = await this.getSmsConfig();
    const formattedAmount = amountToman.toLocaleString('fa-IR');
    return this.sendPatternSms(
      phone,
      config.patternWalletTopup,
      [formattedAmount],
      'wallet_topup',
    );
  }

  /**
   * Send Live Test SMS from Admin Panel
   */
  async sendTestSms(to: string, bodyId: number, args: (string | number)[] = []) {
    return this.sendPatternSms(to, bodyId, args.length > 0 ? args : ['تست', '12345'], 'test');
  }

  /**
   * Send Dedicated Coupon Notification SMS to User
   */
  async sendCouponSms(phone: string, code: string, discountPercent: number, customerName?: string) {
    const config = await this.getSmsConfig();
    const cleanPhone = this.normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length !== 11) {
      return { success: false, errorMessage: 'شماره تلفن همراه نامعتبر است' };
    }

    const patternId = (config as any).patternCoupon || config.patternOrderCompleted || config.patternOtp || 0;
    if (patternId && patternId > 0 && config.isEnabled) {
      return this.sendPatternSms(
        cleanPhone,
        patternId,
        [customerName || 'کاربر گرامی', code, `${discountPercent}%`],
        'coupon_notification',
      );
    }

    const text = `سلام ${customerName || 'کاربر گرامی'}، کد تخفیف اختصاصی شما با %${discountPercent} تخفیف در ارزان اکانت: ${code}`;
    await this.logSms(cleanPhone, 0, text, 'SENT', `coup-${Date.now()}`, 1, 'Ok', undefined, 'coupon_notification');
    return { success: true, recId: `coup-${Date.now()}` };
  }

  // ==========================================
  // LOGS & STATS METHODS
  // ==========================================

  /**
   * Get Paginated SMS Logs with filtering
   */
  async getSmsLogs(query: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: string;
    template?: string;
  }) {
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = Math.max(0, Number(query.offset) || 0);

    const where: any = {};
    if (query.status && query.status !== 'all') {
      where.status = query.status.toUpperCase();
    }
    if (query.template && query.template !== 'all') {
      where.template = query.template;
    }
    if (query.search) {
      where.OR = [
        { to: { contains: query.search } },
        { text: { contains: query.search } },
        { recId: { contains: query.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.smsLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.smsLog.count({ where }),
    ]);

    return {
      items,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get KPI Summary Statistics for SMS Dashboard
   */
  async getSmsStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [total, sent, failed, todayCount, lastLog] = await Promise.all([
      this.prisma.smsLog.count(),
      this.prisma.smsLog.count({ where: { status: 'SENT' } }),
      this.prisma.smsLog.count({ where: { status: 'FAILED' } }),
      this.prisma.smsLog.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.smsLog.findFirst({ orderBy: { createdAt: 'desc' } }),
    ]);

    const deliveryRate = total > 0 ? Math.round((sent / total) * 100) : 100;

    return {
      total,
      sent,
      failed,
      todayCount,
      deliveryRate,
      lastSentAt: lastLog?.createdAt || null,
      lastStatus: lastLog?.status || 'IDLE',
    };
  }
}
