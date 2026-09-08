/**
 * General Notification & Announcement Template (Stitch Variant 3 - Bold Brand Header)
 */

export interface NotificationEmailData {
  title: string;
  message: string;
  customerName?: string;
  buttonText?: string;
  buttonUrl?: string;
  supportTelegram?: string;
  siteUrl?: string;
}

export function renderNotificationEmail(data: NotificationEmailData): { html: string; text: string; subject: string } {
  const siteUrl = data.siteUrl || 'http://localhost:3000';
  const supportTelegram = data.supportTelegram || '@ArzanAccount_Support';
  const subject = `${data.title} - ارزان اکانت`;

  const buttonHtml = data.buttonText && data.buttonUrl
    ? `
      <div style="margin-top: 24px; text-align: center;">
        <a href="${data.buttonUrl}" target="_blank" style="display: inline-block; background-color: #005a71; color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 10px; font-size: 14px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,90,113,0.2);">
          ${data.buttonText} ←
        </a>
      </div>
    `
    : '';

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 24px 10px; background-color: #f1f5f9; font-family: 'Vazirmatn', Tahoma, Arial, sans-serif; color: #0f172a;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,65,83,0.08); border: 1px solid #e2edf1;">
          <!-- Bold Brand Header -->
          <tr>
            <td style="background-color: #005a71; padding: 26px 30px; text-align: center; color: #ffffff;">
              <h2 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                ⚡ ارزان اکانت (Arzan Account)
              </h2>
              <div style="font-size: 12px; color: #b9eaff; margin-top: 6px;">
                سامانه تحویل فوری اشتراک‌های قانونی دیجیتال
              </div>
            </td>
          </tr>

          <!-- Message Body -->
          <tr>
            <td style="padding: 30px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 19px; color: #004153; font-weight: bold; line-height: 1.4;">
                ${data.title}
              </h1>
              <div style="font-size: 14px; line-height: 1.8; color: #334155; white-space: pre-line;">
                ${data.message}
              </div>
              ${buttonHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafb; border-top: 1px solid #edf2f4; padding: 20px 30px; text-align: center; font-size: 11.5px; color: #64748b;">
              <p style="margin: 0 0 6px 0;">
                پشتیبانی ۲۴ ساعته: <a href="https://t.me/${supportTelegram.replace('@', '')}" style="color: #005a71; font-weight: bold; text-decoration: none;">${supportTelegram}</a>
              </p>
              <div style="font-size: 10.5px; color: #94a3b8;">
                تمامی حقوق محفوظ است © ۱۴۰۳ ارزان اکانت
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
${data.title} - ارزان اکانت
--------------------------------------------------
${data.message}

${data.buttonUrl ? `لینک اقدام: ${data.buttonUrl}` : ''}
پشتیبانی تلگرام: https://t.me/${supportTelegram.replace('@', '')}
  `.trim();

  return { html, text, subject };
}
