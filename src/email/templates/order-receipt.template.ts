/**
 * Order Receipt & License Delivery Email Template (Stitch Variant 2 - Modern Structured Receipt)
 * High cross-client deliverability with inline styles and plain-text fallback.
 */

export interface OrderReceiptEmailData {
  orderNumber: string;
  customerName?: string;
  customerEmail: string;
  customerPhone?: string;
  createdAt: string;
  items: Array<{
    productTitle: string;
    quantity: number;
    priceToman: number;
    priceUsd?: number;
    durationDays?: number;
  }>;
  deliveredAccounts?: string[];
  totalPriceToman: number;
  totalPriceUsd?: number;
  paymentGateway?: string;
  supportTelegram?: string;
  siteUrl?: string;
}

export function renderOrderReceiptEmail(data: OrderReceiptEmailData): { html: string; text: string; subject: string } {
  const siteUrl = (data.siteUrl && !data.siteUrl.includes('localhost')) ? data.siteUrl : 'https://arzanaccount.com';
  const supportTelegram = data.supportTelegram || '@ArzanAccount_Support';
  const greeting = data.customerName ? `سلام ${data.customerName} عزیز،` : 'سلام خریدار محترم،';
  const formattedToman = new Intl.NumberFormat('en-US').format(data.totalPriceToman);
  const itemsRows = data.items.map((item, idx) => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e9f2f5; text-align: right;">
        <strong style="color: #101d22; font-size: 13.5px;">${item.productTitle}</strong>
        <div style="font-size: 11.5px; color: #70787d; margin-top: 4px;">تعداد: ${item.quantity} عدد ${item.durationDays ? `• اعتبار: ${item.durationDays} روز` : ''}</div>
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e9f2f5; text-align: left; font-family: monospace; font-size: 13px; font-weight: bold; color: #005a71;">
        ${new Intl.NumberFormat('en-US').format(item.priceToman)} تومان
      </td>
    </tr>
  `).join('');

  const accountsHtml = (data.deliveredAccounts && data.deliveredAccounts.length > 0)
    ? data.deliveredAccounts.map((acc, i) => `
      <div style="background-color: #ffffff; border: 1px solid #c7e5ed; border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; direction: ltr; text-align: left; font-family: 'Courier New', Courier, monospace; font-size: 13.5px; font-weight: bold; color: #004153; word-break: break-all;">
        ${acc}
      </div>
    `).join('')
    : '<div style="background-color: #ffffff; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; color: #64748b; font-size: 13px;">اطلاعات اشتراک به زودی توسط پشتیبانی صادر و در پنل کاربری درج می‌شود.</div>';

  const subject = `رسید و تحویل اشتراک سفارش #${data.orderNumber} - ارزان اکانت`;

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Vazirmatn', Tahoma, Arial, sans-serif; }
    .ltr { direction: ltr; text-align: left; }
  </style>
</head>
<body style="margin: 0; padding: 24px 10px; background-color: #f1f5f9; font-family: 'Vazirmatn', Tahoma, Arial, sans-serif; color: #101d22;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center">
        <!-- Main Email Container (600px) -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,65,83,0.06); border: 1px solid #e2edf1;">
          
          <!-- Top Gradient Accent -->
          <tr>
            <td height="6" style="background: linear-gradient(90deg, #004153 0%, #005a71 50%, #38bdf8 100%);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 24px 28px 20px 28px; border-bottom: 1px solid #edf3f6;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; font-size: 18px; font-weight: 800; color: #005a71; letter-spacing: -0.5px;">
                      ⚡ ارزان اکانت <span style="font-size: 12px; font-weight: normal; color: #70787d;">| ArzanAccount</span>
                    </span>
                  </td>
                  <td align="left" valign="middle">
                    <span style="display: inline-block; padding: 4px 12px; border-radius: 999px; background-color: #eaf4f8; color: #005a71; font-family: monospace; font-size: 12px; font-weight: bold; direction: ltr;">
                      #${data.orderNumber}
                    </span>
                    <div style="font-size: 11px; color: #70787d; margin-top: 4px; text-align: left;">
                      ${data.createdAt}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting & Title -->
          <tr>
            <td style="padding: 24px 28px 12px 28px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="36" valign="middle">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #ecfdf5; border: 1px solid #a7f3d0; text-align: center; line-height: 32px; font-size: 18px; color: #059669;">
                      ✓
                    </div>
                  </td>
                  <td valign="middle" style="padding-right: 12px;">
                    <h1 style="margin: 0; font-size: 20px; font-weight: bold; color: #004153;">
                      رسید پرداخت و تحویل لایسنس
                    </h1>
                  </td>
                </tr>
              </table>
              <p style="margin: 12px 0 0 0; font-size: 13.5px; line-height: 1.6; color: #40484c;">
                ${greeting} خرید شما با موفقیت تایید شد. دسترسی و لایسنس قانونی اکانت شما صادر شده و در زیر آماده بهره‌برداری است.
              </p>
            </td>
          </tr>

          <!-- Credential / License Highlight Box -->
          <tr>
            <td style="padding: 12px 28px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f0f9fa; border: 1px solid #bce6ef; border-radius: 12px; padding: 18px;">
                <tr>
                  <td>
                    <div style="font-size: 13.5px; font-weight: bold; color: #005a71; margin-bottom: 12px;">
                      🔑 <strong>مشخصات اکانت و لایسنس تحویل‌شده:</strong>
                    </div>
                    ${accountsHtml}
                    <div style="font-size: 11.5px; color: #006972; margin-top: 10px; line-height: 1.5;">
                      ℹ️ <em>نکته: در صورت نیاز به ورود به اکانت یا قبول دعوتنامه، لطفاً با ایمیل ثبت‌شده لاگین بفرمایید.</em>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Itemized Order Table -->
          <tr>
            <td style="padding: 16px 28px 12px 28px;">
              <div style="font-size: 13px; font-weight: bold; color: #004153; margin-bottom: 8px;">
                📋 مشخصات فاکتور و اقلام سفارش:
              </div>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fafdfe; border: 1px solid #e1ecf0; border-radius: 10px; overflow: hidden;">
                ${itemsRows}
                <tr>
                  <td style="padding: 14px 16px; background-color: #f2f8fa; text-align: right; font-weight: bold; color: #101d22; font-size: 13px;">
                    مبلغ کل پرداختی:
                  </td>
                  <td style="padding: 14px 16px; background-color: #f2f8fa; text-align: left; font-family: monospace; font-size: 15px; font-weight: bold; color: #059669;">
                    ${formattedToman} تومان
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 3 Quick Steps -->
          <tr>
            <td style="padding: 12px 28px 16px 28px;">
              <div style="font-size: 12.5px; font-weight: bold; color: #40484c; margin-bottom: 10px;">
                ⚡ ۳ مرحله سریع برای فعال‌سازی:
              </div>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="32%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                    <div style="font-size: 11px; font-weight: bold; color: #005a71;">۱. کپی اطلاعات</div>
                    <div style="font-size: 10px; color: #70787d; margin-top: 2px;">اطلاعات باکس بالا</div>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                    <div style="font-size: 11px; font-weight: bold; color: #005a71;">۲. ورود به سرویس</div>
                    <div style="font-size: 10px; color: #70787d; margin-top: 2px;">تایید یا فعال‌سازی</div>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; text-align: center;">
                    <div style="font-size: 11px; font-weight: bold; color: #15803d;">۳. لذت از پرمیوم</div>
                    <div style="font-size: 10px; color: #16a34a; margin-top: 2px;">بدون قطعی و قانونی</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 8px 28px 20px 28px;" align="center">
              <a href="${siteUrl}/orders" target="_blank" style="display: block; width: 100%; box-sizing: border-box; background-color: #005a71; color: #ffffff; text-decoration: none; text-align: center; padding: 13px 20px; border-radius: 10px; font-size: 14px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,90,113,0.18);">
                مشاهده سفارش و پیگیری در پنل کاربری ←
              </a>
            </td>
          </tr>

          <!-- Guarantee & Support Reassurance -->
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafb; border: 1px solid #e9eff2; border-radius: 10px; padding: 12px 16px;">
                <tr>
                  <td align="right" valign="middle">
                    <strong style="color: #101d22; font-size: 12.5px;">🛡️ گارانتی ۱۰۰٪ ارزان اکانت</strong>
                    <div style="color: #70787d; font-size: 11.5px; margin-top: 2px;">پشتیبانی کامل تا آخرین روز اشتراک قانونی شما</div>
                  </td>
                  <td align="left" valign="middle">
                    <a href="https://t.me/${supportTelegram.replace('@', '')}" target="_blank" style="display: inline-block; padding: 6px 14px; border-radius: 8px; background-color: #ffffff; border: 1px solid #d6e3e8; color: #005a71; text-decoration: none; font-size: 12px; font-weight: bold;">
                      پشتیبانی تلگرام
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafb; border-top: 1px solid #edf2f4; padding: 22px 28px; text-align: center; font-size: 11.5px; color: #70787d;">
              <div style="margin-bottom: 10px;">
                <a href="${siteUrl}" style="color: #005a71; text-decoration: none; margin: 0 8px;">وب‌سایت ارزان اکانت</a> •
                <a href="https://t.me/${supportTelegram.replace('@', '')}" style="color: #005a71; text-decoration: none; margin: 0 8px;">کانال تلگرام</a> •
                <a href="${siteUrl}/terms" style="color: #005a71; text-decoration: none; margin: 0 8px;">قوانین و ضمانت</a>
              </div>
              <p style="margin: 0 0 6px 0; line-height: 1.6; max-width: 480px; margin-left: auto; margin-right: auto;">
                این ایمیل رسید رسمی خرید شما از سامانه ارزان اکانت است. در صورتی که این سفارش توسط شما ثبت نشده، به پشتیبانی اطلاع دهید.
              </p>
              <div style="font-size: 10.5px; color: #94a3b8;">
                تمامی حقوق محفوظ است © ۱۴۰۳ ارزان اکانت (Arzan Account)
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

  const plainAccounts = (data.deliveredAccounts && data.deliveredAccounts.length > 0)
    ? data.deliveredAccounts.join('\n')
    : 'اطلاعات در پنل کاربری ثبت خواهد شد.';

  const plainItems = data.items.map((it) => `- ${it.productTitle} (تعداد: ${it.quantity}): ${new Intl.NumberFormat('en-US').format(it.priceToman)} تومان`).join('\n');

  const text = `
رسید پرداخت و تحویل لایسنس - ارزان اکانت
سفارش #${data.orderNumber}
تاریخ: ${data.createdAt}

${greeting}
خرید شما با موفقیت تایید شد. مشخصات لایسنس و دسترسی شما:

--------------------------------------------------
مشخصات اکانت و لایسنس تحویل‌شده:
${plainAccounts}
--------------------------------------------------

اقلام سفارش:
${plainItems}

مبلغ کل: ${formattedToman} تومان
ایمیل خریدار: ${data.customerEmail}

مشاهده سفارش در پنل: ${siteUrl}/orders
پشتیبانی تلگرام: https://t.me/${supportTelegram.replace('@', '')}

با تشکر از خرید شما
ارزان اکانت (Arzan Account)
  `.trim();

  return { html, text, subject };
}
