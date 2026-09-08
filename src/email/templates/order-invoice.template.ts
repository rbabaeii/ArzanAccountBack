/**
 * Order Invoice & Confirmation Template (Stitch Variant 1 - Minimal Light Card)
 */

export interface OrderInvoiceEmailData {
  orderNumber: string;
  customerName?: string;
  customerEmail: string;
  createdAt: string;
  items: Array<{
    productTitle: string;
    quantity: number;
    priceToman: number;
  }>;
  totalPriceToman: number;
  paymentGateway?: string;
  siteUrl?: string;
  supportTelegram?: string;
}

export function renderOrderInvoiceEmail(data: OrderInvoiceEmailData): { html: string; text: string; subject: string } {
  const siteUrl = data.siteUrl || 'http://localhost:3000';
  const supportTelegram = data.supportTelegram || '@ArzanAccount_Support';
  const formattedToman = new Intl.NumberFormat('en-US').format(data.totalPriceToman);
  const greeting = data.customerName ? `سلام ${data.customerName} عزیز،` : 'سلام خریدار گرامی،';
  const subject = `فاکتور و تایید ثبت سفارش #${data.orderNumber} - ارزان اکانت`;

  const itemsList = data.items.map((it) => `
    <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13.5px;">
      <div>
        <strong style="color: #0f172a;">${it.productTitle}</strong>
        <span style="font-size: 12px; color: #64748b; margin-right: 6px;">(${it.quantity} عدد)</span>
      </div>
      <div style="font-family: monospace; font-weight: bold; color: #005a71;">
        ${new Intl.NumberFormat('en-US').format(it.priceToman)} تومان
      </div>
    </div>
  `).join('');

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 24px 10px; background-color: #f8fafc; font-family: 'Vazirmatn', Tahoma, Arial, sans-serif; color: #0f172a;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
          <tr>
            <td style="padding: 24px 28px; border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="right">
                    <strong style="font-size: 18px; color: #005a71;">⚡ ارزان اکانت</strong>
                  </td>
                  <td align="left">
                    <span style="background-color: #e0f2fe; color: #0369a1; font-family: monospace; font-weight: bold; font-size: 12px; padding: 4px 10px; border-radius: 999px;">
                      #${data.orderNumber}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 24px 28px;">
              <h1 style="margin: 0 0 10px 0; font-size: 19px; color: #0f172a; font-weight: bold;">
                تأییدیه ثبت فاکتور سفارش
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 13.5px; line-height: 1.6; color: #475569;">
                ${greeting} سفارش شما با موفقیت در سامانه ثبت گردید و جهت صدور لایسنس به واحد پشتیبانی ارجاع داده شد.
              </p>

              <!-- Order Summary Box -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
                <div style="font-size: 12px; font-weight: bold; color: #64748b; margin-bottom: 10px; text-transform: uppercase;">
                  اقلام فاکتور:
                </div>
                ${itemsList}
                <div style="display: flex; justify-content: space-between; padding-top: 12px; font-size: 14px; font-weight: bold;">
                  <span style="color: #0f172a;">مجموع پرداختی:</span>
                  <span style="color: #059669; font-family: monospace;">${formattedToman} تومان</span>
                </div>
              </div>

              <!-- Button -->
              <a href="${siteUrl}/orders" target="_blank" style="display: block; background-color: #005a71; color: #ffffff; text-decoration: none; text-align: center; padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: bold;">
                مشاهده وضعیت سفارش در سایت
              </a>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 18px 28px; text-align: center; font-size: 11.5px; color: #64748b;">
              پشتیبانی ۲۴ ساعته در تلگرام: <a href="https://t.me/${supportTelegram.replace('@', '')}" style="color: #005a71; font-weight: bold; text-decoration: none;">${supportTelegram}</a>
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
تایید فاکتور سفارش #${data.orderNumber} - ارزان اکانت
${greeting}
سفارش شما با موفقیت ثبت شد و در صف صدور قرار گرفت.

مبلغ پرداختی: ${formattedToman} تومان
مشاهده سفارش: ${siteUrl}/orders
پشتیبانی تلگرام: https://t.me/${supportTelegram.replace('@', '')}
  `.trim();

  return { html, text, subject };
}
