import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import { renderOrderReceiptEmail, OrderReceiptEmailData } from './templates/order-receipt.template';
import { renderOrderInvoiceEmail, OrderInvoiceEmailData } from './templates/order-invoice.template';
import { renderNotificationEmail, NotificationEmailData } from './templates/notification.template';
import { renderTestEmail, TestEmailData } from './templates/test-email.template';
import { renderOtpEmail, OtpEmailData } from './templates/otp-email.template';
import { renderOrderDeliveryEmail, OrderDeliveryEmailData } from './templates/delivery-email.template';
import { renderCustomUserEmail, CustomUserEmailData } from './templates/custom-email.template';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  isEnabled: boolean;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private cachedTransporter: nodemailer.Transporter | null = null;
  private cachedConfigHash = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Resolve active SMTP Configuration from Database or .env fallback
   */
  async getSmtpConfig(): Promise<SmtpConfig> {
    try {
      const dbSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'SMTP_CONFIG' },
      });

      if (dbSetting && dbSetting.value) {
        const parsed = JSON.parse(dbSetting.value);
        const rawFromName = parsed.fromName || this.configService.get('MAIL_FROM_NAME', 'ارزان اکانت');
        return {
          host: parsed.host || this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
          port: Number(parsed.port) || Number(this.configService.get('SMTP_PORT', 465)),
          secure: parsed.secure !== undefined ? Boolean(parsed.secure) : (Number(parsed.port || 465) === 465),
          user: parsed.user || this.configService.get('SMTP_USER', 'rezadalyagpt@gmail.com'),
          pass: parsed.pass || this.configService.get('SMTP_PASS', 'xeuhxtofquloumhs'),
          fromName: rawFromName.replace(/^["']|["']$/g, '').trim(),
          fromEmail: (parsed.fromEmail || this.configService.get('MAIL_FROM_EMAIL', 'rezadalyagpt@gmail.com')).trim(),
          replyTo: (parsed.replyTo || this.configService.get('MAIL_REPLY_TO', 'rezadalyagpt@gmail.com')).trim(),
          isEnabled: parsed.isEnabled !== undefined ? Boolean(parsed.isEnabled) : true,
        };
      }
    } catch (err) {
      this.logger.warn('Failed to parse SMTP_CONFIG from db, using env defaults', err);
    }

    // Default env fallback
    const port = Number(this.configService.get('SMTP_PORT', 465));
    const defaultFromName = this.configService.get('MAIL_FROM_NAME', 'ارزان اکانت');
    return {
      host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
      port,
      secure: this.configService.get('SMTP_SECURE', 'true') === 'true' || port === 465,
      user: this.configService.get('SMTP_USER', 'rezadalyagpt@gmail.com'),
      pass: this.configService.get('SMTP_PASS', 'xeuhxtofquloumhs'),
      fromName: defaultFromName.replace(/^["']|["']$/g, '').trim(),
      fromEmail: this.configService.get('MAIL_FROM_EMAIL', 'rezadalyagpt@gmail.com').trim(),
      replyTo: this.configService.get('MAIL_REPLY_TO', 'rezadalyagpt@gmail.com').trim(),
      isEnabled: this.configService.get('MAIL_ENABLED', 'true') === 'true',
    };
  }

  /**
   * Get or instantiate cached Nodemailer transporter
   */
  private async getTransporter(): Promise<{ transporter: nodemailer.Transporter; config: SmtpConfig }> {
    const config = await this.getSmtpConfig();
    const configHash = `${config.host}:${config.port}:${config.user}:${config.pass}:${config.secure}`;

    if (!this.cachedTransporter || this.cachedConfigHash !== configHash) {
      this.logger.log(`Initializing Nodemailer transporter for ${config.user} on ${config.host}:${config.port}`);
      this.cachedTransporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 8000,
      });
      this.cachedConfigHash = configHash;
    }

    return { transporter: this.cachedTransporter, config };
  }

  /**
   * Core send mail wrapper with spam prevention headers and logging
   */
  private async executeSend(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
    templateName: string;
    metadata?: any;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { transporter, config } = await this.getTransporter();

    if (!config.isEnabled) {
      this.logger.warn(`Email sending is disabled in settings. Skipping email to ${options.to}`);
      await this.prisma.emailLog.create({
        data: {
          to: options.to,
          subject: options.subject,
          template: options.templateName,
          status: 'FAILED',
          errorMessage: 'سرویس ایمیل در تنظیمات سیستم غیرفعال است.',
          metadata: options.metadata ? JSON.stringify(options.metadata) : null,
        },
      });
      return { success: false, error: 'سرویس ایمیل غیرفعال است.' };
    }

    try {
      const cleanFromName = (config.fromName || 'ارزان اکانت').replace(/^["']|["']$/g, '').trim();
      const cleanFromEmail = (config.fromEmail || config.user).trim();
      const cleanReplyTo = (config.replyTo || cleanFromEmail).trim();

      const sendPromise = transporter.sendMail({
        from: {
          name: cleanFromName,
          address: cleanFromEmail,
        },
        to: options.to,
        replyTo: {
          name: cleanFromName,
          address: cleanReplyTo,
        },
        subject: options.subject,
        html: options.html,
        text: options.text,
        headers: {
          'X-Auto-Response-Suppress': 'OOF, AutoReply',
          'Auto-Submitted': 'auto-generated',
        },
      });

      let timer: any;
      const timeoutPromise = new Promise<any>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('اتصال به سرور ایمیل (SMTP) تایم‌اوت شد (مهلت ۸ ثانیه).'));
        }, 8000);
      });

      const result = await Promise.race([sendPromise, timeoutPromise]).finally(() => {
        if (timer) clearTimeout(timer);
      });

      this.logger.log(`Email [${options.templateName}] sent successfully to ${options.to}. MessageId: ${result.messageId}`);

      await this.prisma.emailLog.create({
        data: {
          to: options.to,
          subject: options.subject,
          template: options.templateName,
          status: 'SENT',
          metadata: options.metadata ? JSON.stringify(options.metadata) : null,
        },
      });

      return { success: true, messageId: result.messageId };
    } catch (error: any) {
      const errorMsg = error?.message || 'خطای ناشناخته در ارتباط با سرور SMTP';
      this.logger.error(`Failed to send email to ${options.to}: ${errorMsg}`, error?.stack);

      await this.prisma.emailLog.create({
        data: {
          to: options.to,
          subject: options.subject,
          template: options.templateName,
          status: 'FAILED',
          errorMessage: errorMsg,
          metadata: options.metadata ? JSON.stringify(options.metadata) : null,
        },
      });

      return { success: false, error: errorMsg };
    }
  }

  /**
   * Send Order Receipt & Credentials (Stitch Variant 2)
   */
  async sendOrderReceipt(data: OrderReceiptEmailData) {
    const { html, text, subject } = renderOrderReceiptEmail(data);
    return this.executeSend({
      to: data.customerEmail,
      subject,
      html,
      text,
      templateName: 'order_receipt',
      metadata: { orderNumber: data.orderNumber, totalToman: data.totalPriceToman },
    });
  }

  /**
   * Send Order Confirmation / Invoice (Stitch Variant 1)
   */
  async sendOrderInvoice(data: OrderInvoiceEmailData) {
    const { html, text, subject } = renderOrderInvoiceEmail(data);
    return this.executeSend({
      to: data.customerEmail,
      subject,
      html,
      text,
      templateName: 'order_invoice',
      metadata: { orderNumber: data.orderNumber },
    });
  }

  /**
   * Send General Notification / Announcement (Stitch Variant 3)
   */
  async sendNotification(to: string, data: NotificationEmailData) {
    const { html, text, subject } = renderNotificationEmail(data);
    return this.executeSend({
      to,
      subject,
      html,
      text,
      templateName: 'notification',
      metadata: { title: data.title },
    });
  }

  /**
   * Send One-Time Password (OTP) code via Email for login
   */
  async sendOtpEmail(to: string, code: string, phone: string) {
    const { html, text, subject } = renderOtpEmail({ code, phone });
    return this.executeSend({
      to,
      subject,
      html,
      text,
      templateName: 'otp_code',
      metadata: { phone },
    });
  }

  /**
   * Send Order Delivery / Activation / Refund Email
   */
  async sendDeliveryEmail(data: OrderDeliveryEmailData) {
    const { html, text, subject } = renderOrderDeliveryEmail(data);
    return this.executeSend({
      to: data.customerEmail,
      subject,
      html,
      text,
      templateName: data.deliveryType,
      metadata: { orderNumber: data.orderNumber, productTitle: data.productTitle },
    });
  }

  /**
   * Send Custom Direct Email to Any User
   */
  async sendCustomUserEmail(data: CustomUserEmailData) {
    const { html, text, subject } = renderCustomUserEmail(data);
    return this.executeSend({
      to: data.recipientEmail,
      subject,
      html,
      text,
      templateName: 'custom_direct',
      metadata: {
        recipientName: data.recipientName,
        badge: data.badge,
        adminSender: data.adminSender,
      },
    });
  }

  /**
   * Send Account Withdrawal Status Notification (Approved or Rejected)
   */
  async sendWithdrawalStatusEmail(data: {
    recipientEmail: string;
    customerName: string;
    amountToman: number;
    status: 'APPROVED' | 'REJECTED';
    bankName?: string;
    destination?: string;
    bankTrackingCode?: string;
    bankReceiptUrl?: string;
    rejectionReason?: string;
    siteUrl?: string;
  }) {
    const isApproved = data.status === 'APPROVED';
    const amountFormatted = `${new Intl.NumberFormat('fa-IR').format(data.amountToman)} تومان`;
    const title = isApproved ? 'واریز وجه تسویه حساب بانکی' : 'عدم تایید درخواست تسویه حساب';
    const subject = isApproved
      ? `تایید و واریز تسویه حساب ${amountFormatted} - ارزان اکانت`
      : `عدم تایید درخواست تسویه حساب ${amountFormatted} - ارزان اکانت`;

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body dir="rtl" style="margin: 0; padding: 24px 10px; background-color: #f1f5f9; font-family: 'Vazirmatn', Tahoma, Arial, sans-serif; color: #0f172a; direction: rtl !important; text-align: right !important;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" dir="rtl" style="direction: rtl !important; text-align: right !important;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" dir="rtl" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,65,83,0.08); border: 1px solid #e2edf1; direction: rtl !important; text-align: right !important;">
          <tr>
            <td style="background-color: ${isApproved ? '#059669' : '#e11d48'}; padding: 26px 30px; text-align: center; color: #ffffff;">
              <h2 style="margin: 0; font-size: 22px; font-weight: 800;">
                ${isApproved ? '✅ تسویه حساب با موفقیت انجام شد' : '❌ درخواست تسویه حساب رد شد'}
              </h2>
              <div style="font-size: 13px; color: #ffffff; opacity: 0.9; margin-top: 6px;">
                ارزان اکانت - واحد مالی و حسابداری
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 32px;">
              <p style="font-size: 14px; line-height: 1.8; color: #334155; margin-top: 0;">
                کاربر گرامی <strong>${data.customerName || 'همراه ارزان اکانت'}</strong>،
              </p>
              ${isApproved ? `
                <p style="font-size: 14px; line-height: 1.8; color: #334155;">
                  درخواست تسویه حساب شما به مبلغ <strong>${amountFormatted}</strong> با موفقیت توسط واحد مالی تایید و از طریق سیکل پایا / ساتنا به حساب بانکی شما واریز گردید.
                </p>
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 20px 0;">
                  <div style="font-size: 13px; color: #166534; margin-bottom: 8px;">
                    <strong>مبلغ واریز شده:</strong> ${amountFormatted}
                  </div>
                  ${data.bankName ? `<div style="font-size: 13px; color: #166534; margin-bottom: 8px;"><strong>بانک مقصد:</strong> ${data.bankName}</div>` : ''}
                  ${data.destination ? `<div style="font-size: 13px; color: #166534; margin-bottom: 8px;"><strong>مقصد واریز:</strong> <span style="font-family: monospace; direction: ltr; display: inline-block;">${data.destination}</span></div>` : ''}
                  ${data.bankTrackingCode ? `<div style="font-size: 13px; color: #166534; margin-bottom: 8px;"><strong>کد رهگیری بانکی / شماره سند:</strong> <span style="font-family: monospace; direction: ltr; display: inline-block;">${data.bankTrackingCode}</span></div>` : ''}
                  ${data.bankReceiptUrl ? `<div style="font-size: 12px; margin-top: 10px;"><a href="${data.bankReceiptUrl}" target="_blank" style="color: #059669; font-weight: bold; text-decoration: underline;">مشاهده تصویر فیش واریزی</a></div>` : ''}
                </div>
                <p style="font-size: 12px; color: #64748b; line-height: 1.8;">
                  نکته: با توجه به چرخه‌های زمان‌بندی شبکه پایا و ساتنا بانک مرکزی، ثبت مبلغ در گردش حساب شما ممکن است چند ساعت زمان ببرد.
                </p>
              ` : `
                <p style="font-size: 14px; line-height: 1.8; color: #334155;">
                  درخواست تسویه حساب شما به مبلغ <strong>${amountFormatted}</strong> توسط واحد مالی مورد تایید قرار نگرفت.
                </p>
                <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 16px; margin: 20px 0;">
                  <div style="font-size: 13px; color: #9f1239; margin-bottom: 8px;">
                    <strong>دلیل رد درخواست:</strong> ${data.rejectionReason || 'عدم تطابق اطلاعات بانکی یا نقض قوانین تسویه حساب'}
                  </div>
                  <div style="font-size: 12px; color: #9f1239; margin-top: 6px;">
                    ℹ️ کل مبلغ ${amountFormatted} مجدداً و به صورت آنی به موجودی کیف پول شما بازگردانده شد.
                  </div>
                </div>
                <p style="font-size: 12px; color: #64748b; line-height: 1.8;">
                  جهت پیگیری بیشتر می‌توانید با پشتیبانی تلگرام تماس حاصل نموده یا پس از اصلاح مشخصات بانکی، مجدداً درخواست تسویه ثبت فرمایید.
                </p>
              `}
              <div style="text-align: center; margin-top: 24px;">
                <a href="${data.siteUrl || 'https://arzanaccount.com'}/profile" style="display: inline-block; background-color: #005a71; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 13px; font-weight: bold;">
                  مشاهده پروفایل و کیف پول ←
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const text = `
${title} - ارزان اکانت
--------------------------------------------------
کاربر گرامی ${data.customerName || ''}
مبلغ: ${data.amountToman} تومان
وضعیت: ${isApproved ? 'واریز شد' : 'رد شد'}
${isApproved ? `کد رهگیری: ${data.bankTrackingCode || '-'}` : `علت: ${data.rejectionReason || '-'}\nمبلغ به کیف پول بازگردانده شد.`}
    `.trim();

    return this.executeSend({
      to: data.recipientEmail,
      subject,
      html,
      text,
      templateName: isApproved ? 'withdrawal_approved' : 'withdrawal_rejected',
      metadata: {
        amountToman: data.amountToman,
        status: data.status,
        bankTrackingCode: data.bankTrackingCode,
      },
    });
  }

  /**
   * Send Diagnostic Test Email
   */
  async sendTestEmail(to: string, templateType = 'test') {
    const config = await this.getSmtpConfig();
    const now = new Date();
    const sentAt = new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(now);

    if (templateType === 'order_receipt') {
      return this.sendOrderReceipt({
        orderNumber: 'TEST-99201',
        customerName: 'کاربر گرامی',
        customerEmail: to,
        createdAt: sentAt,
        items: [
          {
            productTitle: 'اکانت قانونی تلگرام پرمیوم (۳ ماهه)',
            quantity: 1,
            priceToman: 450000,
            durationDays: 90,
          },
        ],
        deliveredAccounts: [
          'کد فعال‌سازی لایسنس: ARZAN-TG-99201-PREMIUM',
          'راهنمای فعال‌سازی: https://arzanaccount.com/help',
        ],
        totalPriceToman: 450000,
        siteUrl: 'https://arzanaccount.com',
      });
    }

    if (templateType === 'order_invoice') {
      return this.sendOrderInvoice({
        orderNumber: 'TEST-99201',
        customerName: 'کاربر گرامی',
        customerEmail: to,
        createdAt: sentAt,
        items: [
          {
            productTitle: 'اشتراک تست هوش مصنوعی ChatGPT Plus',
            quantity: 1,
            priceToman: 980000,
          },
        ],
        totalPriceToman: 980000,
        siteUrl: 'https://arzanaccount.com',
      });
    }

    if (templateType === 'notification') {
      return this.sendNotification(to, {
        title: 'پیام اطلاع‌رسانی از سرور ارزان اکانت',
        message: 'این پیام جهت اطمینان از عملکرد صحیح موتور ایمیل و رعایت استانداردهای ضد اسپم ارسال گردیده است.',
        buttonText: 'مشاهده وب‌سایت',
        buttonUrl: 'https://arzanaccount.com',
        siteUrl: 'https://arzanaccount.com',
      });
    }

    // Default: Diagnostic Test
    const { html, text, subject } = renderTestEmail({
      host: config.host,
      port: config.port,
      user: config.user,
      fromName: config.fromName,
      fromEmail: config.fromEmail,
      sentAt,
      serverTime: now.toISOString(),
    });

    return this.executeSend({
      to,
      subject,
      html,
      text,
      templateName: 'test',
      metadata: { type: 'diagnostic_smtp_test' },
    });
  }

  /**
   * Get Settings for Admin UI (password masked)
   */
  async getSettingsForAdmin() {
    const config = await this.getSmtpConfig();
    return {
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      passMasked: config.pass ? '••••••••' : '',
      fromName: config.fromName,
      fromEmail: config.fromEmail,
      replyTo: config.replyTo,
      isEnabled: config.isEnabled,
    };
  }

  /**
   * Update Settings from Admin UI
   */
  async updateSettings(newConfig: Partial<SmtpConfig>, adminUser = 'مدیر ارشد') {
    const current = await this.getSmtpConfig();
    const merged: SmtpConfig = {
      host: newConfig.host?.trim() || current.host,
      port: Number(newConfig.port) || current.port,
      secure: newConfig.secure !== undefined ? Boolean(newConfig.secure) : current.secure,
      user: newConfig.user?.trim() || current.user,
      pass: newConfig.pass && newConfig.pass.trim() && newConfig.pass !== '••••••••'
        ? newConfig.pass.trim()
        : current.pass,
      fromName: newConfig.fromName?.trim() || current.fromName,
      fromEmail: newConfig.fromEmail?.trim() || current.fromEmail,
      replyTo: newConfig.replyTo?.trim() || current.replyTo,
      isEnabled: newConfig.isEnabled !== undefined ? Boolean(newConfig.isEnabled) : current.isEnabled,
    };

    await this.prisma.systemSetting.upsert({
      where: { key: 'SMTP_CONFIG' },
      update: { value: JSON.stringify(merged) },
      create: { key: 'SMTP_CONFIG', value: JSON.stringify(merged) },
    });

    // Invalidate cached transporter so next send uses updated credentials
    this.cachedTransporter = null;
    this.cachedConfigHash = '';

    await this.prisma.auditLog.create({
      data: {
        action: 'به‌روزرسانی تنظیمات سرویس ایمیل (SMTP)',
        details: `تنظیمات سرور ایمیل (${merged.host}:${merged.port}) و فرستنده ${merged.fromName} توسط ${adminUser} ویرایش شد.`,
        user: adminUser,
        type: 'email_settings_update',
      },
    });

    return this.getSettingsForAdmin();
  }

  /**
   * Get Email Analytics & Stats
   */
  async getEmailStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [total, sent, failed, todayCount] = await Promise.all([
      this.prisma.emailLog.count(),
      this.prisma.emailLog.count({ where: { status: 'SENT' } }),
      this.prisma.emailLog.count({ where: { status: 'FAILED' } }),
      this.prisma.emailLog.count({ where: { createdAt: { gte: todayStart } } }),
    ]);

    const deliveryRate = total > 0 ? Math.round((sent / total) * 100) : 100;
    const lastEmail = await this.prisma.emailLog.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    return {
      total,
      sent,
      failed,
      todayCount,
      deliveryRate,
      lastSentAt: lastEmail?.createdAt || null,
      lastStatus: lastEmail?.status || 'IDLE',
    };
  }

  /**
   * Get Paginated Email Logs
   */
  async getEmailLogs(params?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (params?.status && params.status !== 'all') {
      where.status = params.status;
    }

    if (params?.search) {
      const s = params.search.trim();
      where.OR = [
        { to: { contains: s } },
        { subject: { contains: s } },
        { template: { contains: s } },
      ];
    }

    const [logs, total] = await Promise.all([
      this.prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params?.limit ? Number(params.limit) : 30,
        skip: params?.offset ? Number(params.offset) : 0,
      }),
      this.prisma.emailLog.count({ where }),
    ]);

    return { logs, total };
  }
}
