/**
 * Delivery & Activation Email Templates for arzanAccount
 * Supports:
 * - Activation link
 * - Account credentials
 * - Pending admin activation
 * - Completed activation
 * - Refund completed
 */

export interface OrderDeliveryEmailData {
  orderNumber: string;
  customerName?: string;
  customerEmail: string;
  productTitle: string;
  deliveryType: 'link' | 'credentials' | 'pending_activation' | 'activation_completed' | 'refund_completed';
  activationLink?: string;
  accountCredentials?: string[];
  targetAccountEmail?: string;
  refundAmountToman?: number;
  refundTrackingCode?: string;
  refundCardNumber?: string;
  siteUrl?: string;
}

export function renderOrderDeliveryEmail(data: OrderDeliveryEmailData): { html: string; text: string; subject: string } {
  const name = data.customerName || 'کاربر گرامی';
  const siteUrl = data.siteUrl || 'https://arzanaccount.com';

  let subject = '';
  let badgeTitle = '';
  let badgeColor = '#0d9488';
  let bodyContentHtml = '';
  let bodyContentText = '';

  switch (data.deliveryType) {
    case 'link':
      subject = `لینک فعال‌سازی سفارش ${data.orderNumber} - ${data.productTitle}`;
      badgeTitle = 'لینک فعال‌سازی آماده است';
      badgeColor = '#0d9488';
      bodyContentHtml = `
        <p style="font-size: 14px; line-height: 1.8; color: #334155;">
          ${name} عزیز، سفارش شما برای محصول <strong>${data.productTitle}</strong> با موفقیت تکمیل شد.
        </p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
          <span style="font-size: 12px; color: #166534; font-weight: 600; display: block; margin-bottom: 8px;">لینک فعال‌سازی اختصاصی شما:</span>
          <a href="${data.activationLink || siteUrl}" style="background: #0d9488; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 13px; display: inline-block;">
            ورود به لینک فعال‌سازی
          </a>
          <p style="font-size: 11px; color: #475569; margin-top: 12px; word-break: break-all; font-family: monospace;">
            ${data.activationLink || siteUrl}
          </p>
        </div>
      `;
      bodyContentText = `سفارش ${data.orderNumber} تکمیل شد.\nمحصول: ${data.productTitle}\nلینک فعال‌سازی: ${data.activationLink || siteUrl}`;
      break;

    case 'credentials':
      subject = `مشخصات اکانت سفارش ${data.orderNumber} - ${data.productTitle}`;
      badgeTitle = 'مشخصات اکانت تحویل داده شد';
      badgeColor = '#0284c7';
      const creds = (data.accountCredentials || []).map(c => `<li style="margin-bottom: 6px; font-family: monospace; font-size: 13px;">${c}</li>`).join('');
      bodyContentHtml = `
        <p style="font-size: 14px; line-height: 1.8; color: #334155;">
          ${name} عزیز، اطلاعات حساب کاربری محصول <strong>${data.productTitle}</strong> برای شما صادر شد:
        </p>
        <div style="background: #f8fafc; border: 1px dashed #0284c7; border-radius: 12px; padding: 18px; margin: 20px 0;">
          <ul style="padding-right: 20px; margin: 0; color: #0f172a;">
            ${creds || '<li>اطلاعات ورود در پنل کاربری ثبت شده است.</li>'}
          </ul>
        </div>
        <p style="font-size: 12px; color: #64748b;">
          جهت حفظ امنیت، توصیه می‌شود در صورت امکان پس از اولین ورود نسبت به تغییر رمز عبور اقدام فرمایید.
        </p>
      `;
      bodyContentText = `سفارش ${data.orderNumber} تحویل شد.\nمحصول: ${data.productTitle}\nمشخصات: ${(data.accountCredentials || []).join(' | ')}`;
      break;

    case 'pending_activation':
      subject = `ثبت سفارش ${data.orderNumber} - در صف فعال‌سازی کارشناسان`;
      badgeTitle = 'در انتظار فعال‌سازی روی اکانت شما';
      badgeColor = '#d97706';
      bodyContentHtml = `
        <p style="font-size: 14px; line-height: 1.8; color: #334155;">
          ${name} عزیز، سفارش شما با موفقیت ثبت شد و اطلاعات اکانت شما جهت فعال‌سازی بر روی محصول <strong>${data.productTitle}</strong> در صف کارشناسان پشتیبانی قرار گرفت.
        </p>
        <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 18px; margin: 20px 0;">
          <span style="font-size: 12px; color: #92400e; font-weight: bold; display: block; margin-bottom: 6px;">حساب هدف جهت فعال‌سازی:</span>
          <span style="font-family: monospace; font-size: 13px; color: #78350f;">${data.targetAccountEmail || 'ثبت شده در سفارش'}</span>
        </div>
        <p style="font-size: 12px; line-height: 1.7; color: #64748b;">
          کارشناسان ما به زودی فعال‌سازی را روی اکانت شما انجام خواهند داد و به محض تکمیل، ایمیل تایید نهایی برای شما ارسال خواهد شد.
        </p>
      `;
      bodyContentText = `سفارش ${data.orderNumber} با موفقیت ثبت شد.\nمحصول: ${data.productTitle}\nاکانت هدف: ${data.targetAccountEmail}\nوضعیت: در صف فعال‌سازی کارشناسان`;
      break;

    case 'activation_completed':
      subject = `اشتراک شما با موفقیت فعال شد - سفارش ${data.orderNumber}`;
      badgeTitle = 'فعال‌سازی تکمیل شد';
      badgeColor = '#059669';
      bodyContentHtml = `
        <p style="font-size: 14px; line-height: 1.8; color: #334155;">
          ${name} عزیز، با خوشحالی به اطلاع می‌رسانیم که اشتراک محصول <strong>${data.productTitle}</strong> با موفقیت بر روی اکانت شما فعال گردید!
        </p>
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 18px; margin: 20px 0; text-align: center;">
          <span style="font-size: 14px; color: #065f46; font-weight: bold; display: block;">
            اکانت شما هم‌اکنون فعال و آماده استفاده است.
          </span>
        </div>
        <p style="font-size: 12px; color: #64748b;">
          در صورت بروز هرگونه سوال یا نیاز به پشتیبانی، از طریق تیکت یا پشتیبانی تلگرام در کنار شما هستیم.
        </p>
      `;
      bodyContentText = `سفارش ${data.orderNumber} تکمیل شد.\nمحصول: ${data.productTitle}\nاشتراک شما با موفقیت بر روی اکانت فعال گردید.`;
      break;

    case 'refund_completed':
      subject = `تسویه و عودت وجه سفارش ${data.orderNumber}`;
      badgeTitle = 'عودت وجه انجام شد';
      badgeColor = '#4f46e5';
      bodyContentHtml = `
        <p style="font-size: 14px; line-height: 1.8; color: #334155;">
          ${name} عزیز، مبلغ سفارش <strong>${data.orderNumber}</strong> با موفقیت به حساب بانکی شما عودت داده شد.
        </p>
        <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 12px; padding: 18px; margin: 20px 0;">
          <div style="font-size: 13px; color: #312e81; margin-bottom: 6px;">
            <strong>مبلغ عودت:</strong> ${data.refundAmountToman ? Number(data.refundAmountToman).toLocaleString('en-US') + ' تومان' : '-'}
          </div>
          ${data.refundCardNumber ? `<div style="font-size: 13px; color: #312e81; margin-bottom: 6px;"><strong>شماره کارت مقصد:</strong> <span style="font-family: monospace;">${data.refundCardNumber}</span></div>` : ''}
          ${data.refundTrackingCode ? `<div style="font-size: 13px; color: #312e81;"><strong>کد رهگیری بانکی:</strong> <span style="font-family: monospace;">${data.refundTrackingCode}</span></div>` : ''}
        </div>
      `;
      bodyContentText = `سفارش ${data.orderNumber} عودت داده شد.\nمبلغ: ${data.refundAmountToman} تومان\nکد رهگیری: ${data.refundTrackingCode}`;
      break;
  }

  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body dir="rtl" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Tahoma, Arial, sans-serif; background-color: #f1f5f9; color: #0f172a; margin: 0; padding: 24px 12px; direction: rtl !important; text-align: right !important;">
  <div class="container" dir="rtl" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; direction: rtl !important; text-align: right !important;">
    <div style="background: ${badgeColor}; padding: 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 800; color: #ffffff;">ارزان اکانت</h1>
      <span style="font-size: 12px; opacity: 0.95; font-weight: 600;">${badgeTitle}</span>
    </div>
    <div style="padding: 28px 24px; direction: rtl !important; text-align: right !important;">
      <div style="font-size: 12px; color: #64748b; margin-bottom: 16px; direction: rtl; text-align: right;">
        شماره سفارش: <strong style="font-family: monospace; color: #0f172a; direction: ltr; display: inline-block;">#${data.orderNumber}</strong>
      </div>
      ${bodyContentHtml}
      <div style="margin-top: 24px; text-align: center;">
        <a href="${siteUrl}/orders?id=${data.orderNumber}" style="background: #0f172a; color: #ffffff; font-size: 12px; font-weight: bold; padding: 10px 20px; border-radius: 8px; text-decoration: none; display: inline-block;">
          مشاهده جزئیات سفارش در سایت
        </a>
      </div>
    </div>
    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11px; color: #64748b; direction: rtl;">
      ارزان اکانت | مرجع تخصصی لایسنس و اشتراک‌های دیجیتال
      <br>
      <a href="${siteUrl}" style="color: #0d9488; text-decoration: none;">${siteUrl}</a>
    </div>
  </div>
</body>
</html>`;

  return { html, text: bodyContentText, subject };
}
