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
  refundMethod?: 'bank_card' | 'wallet';
  refundReceiptUrl?: string;
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
          <p style="font-size: 13px; color: #166534; margin-bottom: 12px;">روی دکمه زیر کلیک کنید تا وارد فرایند دریافت و فعال‌سازی اکانت خود شوید:</p>
          <a href="${data.activationLink || siteUrl}" style="background: #0d9488; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
            ورود به صفحه فعال‌سازی اشتراک
          </a>
        </div>
      `;
      bodyContentText = `سفارش ${data.orderNumber} تکمیل شد.\nمحصول: ${data.productTitle}\nلینک فعال‌سازی: ${data.activationLink || siteUrl}`;
      break;

    case 'credentials':
      subject = `اطلاعات و لایسنس سفارش ${data.orderNumber} - ${data.productTitle}`;
      badgeTitle = 'سفارش تحویل داده شد';
      badgeColor = '#0d9488';
      const accountsList = (data.accountCredentials || [])
        .map((acc, i) => `<div style="font-family: monospace; background: #f8fafc; padding: 10px; border-radius: 6px; margin: 6px 0; border: 1px dashed #cbd5e1; direction: ltr; text-align: left;">${acc}</div>`)
        .join('');

      bodyContentHtml = `
        <p style="font-size: 14px; line-height: 1.8; color: #334155;">
          ${name} عزیز، اطلاعات دسترسی و لایسنس‌های سفارش شما به شرح زیر صادر گردید:
        </p>
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <strong style="font-size: 13px; color: #0f172a;">لایسنس‌ها و اطلاعات اکانت:</strong>
          ${accountsList || '<p style="color: #64748b;">اطلاعاتی یافت نشد.</p>'}
        </div>
        <p style="font-size: 12px; color: #64748b;">
          لطفاً اطلاعات فوق را در محلی امن نگهداری فرمایید.
        </p>
      `;
      bodyContentText = `سفارش ${data.orderNumber} تحویل شد.\nمحصول: ${data.productTitle}\nلایسنس‌ها:\n${(data.accountCredentials || []).join('\n')}`;
      break;

    case 'pending_activation':
      subject = `سفارش ${data.orderNumber} در صف فعال‌سازی کارشناسان`;
      badgeTitle = 'در حال انجام توسط کارشناس';
      badgeColor = '#d97706';
      bodyContentHtml = `
        <p style="font-size: 14px; line-height: 1.8; color: #334155;">
          ${name} عزیز، سفارش شما برای <strong>${data.productTitle}</strong> با موفقیت ثبت شد و هم‌اکنون توسط کارشناسان ارزان اکانت در صف پردازش و فعال‌سازی اختصاصی قرار دارد.
        </p>
        ${data.targetAccountEmail ? `
        <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 12px; padding: 14px; margin: 16px 0;">
          <span style="font-size: 13px; color: #854d0e;">ایمیل اکانت جهت فعال‌سازی:</span>
          <strong style="font-family: monospace; display: block; margin-top: 4px;">${data.targetAccountEmail}</strong>
        </div>
        ` : ''}
        <p style="font-size: 12px; color: #64748b;">
          به محض انجام فعال‌سازی، ایمیل تکمیل و تایید نهایی برای شما ارسال خواهد شد.
        </p>
      `;
      bodyContentText = `سفارش ${data.orderNumber} در حال انجام است.\nمحصول: ${data.productTitle}\nاکانت: ${data.targetAccountEmail || '-'}`;
      break;

    case 'activation_completed':
      subject = `فعال‌سازی سفارش ${data.orderNumber} با موفقیت انجام شد`;
      badgeTitle = 'اکانت شما با موفقیت فعال شد';
      badgeColor = '#059669';
      bodyContentHtml = `
        <p style="font-size: 14px; line-height: 1.8; color: #334155;">
          ${name} عزیز، اشتراک سفارش <strong>${data.productTitle}</strong> بر روی اکانت شما با موفقیت فعال گردید.
        </p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="font-size: 13px; color: #166534; margin: 0;">
            هم‌اکنون می‌توانید وارد برنامه/اکانت خود شده و از تمامی امکانات نسخه پریمیوم بدون محدودیت لذت ببرید.
          </p>
        </div>
        <p style="font-size: 12px; color: #64748b;">
          در صورت بروز هرگونه سوال یا نیاز به پشتیبانی، از طریق تیکت یا پشتیبانی تلگرام در کنار شما هستیم.
        </p>
      `;
      bodyContentText = `سفارش ${data.orderNumber} تکمیل شد.\nمحصول: ${data.productTitle}\nاشتراک شما با موفقیت بر روی اکانت فعال گردید.`;
      break;

    case 'refund_completed':
      const isWallet = data.refundMethod === 'wallet' || (data.refundCardNumber && data.refundCardNumber.includes('کیف پول'));
      subject = isWallet
        ? `شارژ کیف پول و عودت وجه سفارش #${data.orderNumber} - ارزان اکانت`
        : `تسویه و عودت وجه سفارش #${data.orderNumber} - ارزان اکانت`;
      badgeTitle = isWallet ? 'شارژ کیف پول (عودت وجه)' : 'تسویه و عودت وجه بانکی';
      badgeColor = isWallet ? '#0d9488' : '#059669';

      const amountFormatted = data.refundAmountToman ? Number(data.refundAmountToman).toLocaleString('fa-IR') + ' تومان' : '-';

      bodyContentHtml = isWallet
        ? `
          <p style="font-size: 14px; line-height: 1.9; color: #334155; margin-bottom: 16px;">
            ${name} عزیز، درخواست عودت وجه سفارش <strong>#${data.orderNumber}</strong> تایید و مبلغ مربوطه بلافاصله به <strong>کیف پول حساب کاربری شما</strong> در وب‌سایت ارزان اکانت واریز گردید.
          </p>
          <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 14px; padding: 18px; margin: 20px 0;">
            <div style="font-size: 13px; color: #115e59; margin-bottom: 8px;">
              <strong>مبلغ شارژ شده:</strong> ${amountFormatted}
            </div>
            <div style="font-size: 13px; color: #115e59; margin-bottom: 8px;">
              <strong>روش عودت:</strong> شارژ آنی کیف پول سایت (اعتبار کاربری)
            </div>
            ${data.refundTrackingCode ? `<div style="font-size: 13px; color: #115e59;"><strong>شناسه ارجاع / پیگیری:</strong> <span style="font-family: monospace;">${data.refundTrackingCode}</span></div>` : ''}
          </div>
          <p style="font-size: 12px; color: #64748b; line-height: 1.8;">
            شما هم‌اکنون می‌توانید با مراجعه به پنل کاربری خود، از این موجودی جهت خرید هر یک از محصولات و اشتراک‌های دیجیتال بدون نیاز به پرداخت مجدد استفاده نمایید.
          </p>
        `
        : `
          <p style="font-size: 14px; line-height: 1.9; color: #334155; margin-bottom: 16px;">
            ${name} عزیز، درخواست عودت وجه سفارش <strong>#${data.orderNumber}</strong> با موفقیت توسط بخش مالی تسویه و وجه به حساب بانکی شما واریز گردید.
          </p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 18px; margin: 20px 0;">
            <div style="font-size: 13px; color: #166534; margin-bottom: 8px;">
              <strong>مبلغ واریز شده:</strong> ${amountFormatted}
            </div>
            ${data.refundCardNumber ? `<div style="font-size: 13px; color: #166534; margin-bottom: 8px;"><strong>شماره کارت / شبا مقصد:</strong> <span style="font-family: monospace; direction: ltr; display: inline-block;">${data.refundCardNumber}</span></div>` : ''}
            ${data.refundTrackingCode ? `<div style="font-size: 13px; color: #166534; margin-bottom: 8px;"><strong>کد رهگیری بانکی / شماره سند:</strong> <span style="font-family: monospace; direction: ltr; display: inline-block;">${data.refundTrackingCode}</span></div>` : ''}
            ${data.refundReceiptUrl ? `<div style="font-size: 12px; margin-top: 10px;"><a href="${data.refundReceiptUrl}" target="_blank" style="color: #059669; font-weight: bold; text-decoration: underline;">مشاهده تصویر فیش واریزی</a></div>` : ''}
          </div>
          <p style="font-size: 12px; color: #64748b; line-height: 1.8;">
            بسته به چرخه پایا و ساتنا و بانک مقصد، ممکن است واریز در گردش حساب شما ظاهر شود.
          </p>
        `;

      bodyContentText = isWallet
        ? `سفارش #${data.orderNumber} به کیف پول عودت داده شد.\nمبلغ: ${data.refundAmountToman} تومان\nشناسه: ${data.refundTrackingCode}`
        : `سفارش #${data.orderNumber} به حساب بانکی عودت داده شد.\nمبلغ: ${data.refundAmountToman} تومان\nکد رهگیری: ${data.refundTrackingCode}`;
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
