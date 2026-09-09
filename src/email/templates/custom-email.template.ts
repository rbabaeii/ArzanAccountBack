/**
 * Custom User Direct Email Template (Admin Direct Communication)
 */

export interface CustomUserEmailData {
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  message: string;
  badge?: string;
  buttonText?: string;
  buttonUrl?: string;
  adminSender?: string;
  siteUrl?: string;
  supportTelegram?: string;
}

export function renderCustomUserEmail(data: CustomUserEmailData): { html: string; text: string; subject: string } {
  const siteUrl = (data.siteUrl && !data.siteUrl.includes('localhost')) ? data.siteUrl : 'https://arzanaccount.com';
  const supportTelegram = data.supportTelegram || '@ArzanAccount_Support';
  const subject = data.subject || 'پیام از طرف مدیریت ارزان اکانت';
  const recipientName = data.recipientName ? data.recipientName.trim() : 'کاربر گرامی';
  const badgeText = data.badge || 'پیام اختصاصی مدیریت';
  const senderTitle = data.adminSender || 'مدیریت و پشتیبانی ارزان اکانت';

  const safeButtonUrl = data.buttonUrl
    ? (data.buttonUrl.includes('localhost') ? siteUrl : data.buttonUrl)
    : '';

  const buttonHtml = data.buttonText && safeButtonUrl
    ? `
      <div style="margin-top: 28px; text-align: center;">
        <a href="${safeButtonUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #005a71 0%, #007c99 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 14.5px; font-weight: bold; box-shadow: 0 4px 14px rgba(0,90,113,0.25);">
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
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,65,83,0.08); border: 1px solid #e2edf1;">
          <!-- Header Bar -->
          <tr>
            <td style="background: linear-gradient(135deg, #003644 0%, #005a71 100%); padding: 26px 30px; text-align: center; color: #ffffff;">
              <div style="display: inline-block; background-color: rgba(255,255,255,0.15); color: #b9eaff; font-size: 11.5px; padding: 4px 12px; border-radius: 20px; margin-bottom: 8px; font-weight: bold; border: 1px solid rgba(185,234,255,0.25);">
                ${badgeText}
              </div>
              <h2 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                ⚡ ارزان اکانت (Arzan Account)
              </h2>
              <div style="font-size: 12px; color: #b9eaff; margin-top: 5px;">
                سامانه هوشمند اشتراک‌ها و لایسنس‌های قانونی
              </div>
            </td>
          </tr>

          <!-- Greeting & Main Message -->
          <tr>
            <td style="padding: 32px 36px;">
              <div style="font-size: 15px; font-weight: 700; color: #004153; margin-bottom: 16px;">
                سلام ${recipientName}،
              </div>

              <div style="font-size: 14.5px; line-height: 1.85; color: #334155; white-space: pre-line; background-color: #f8fafc; border: 1px solid #edf2f7; border-radius: 12px; padding: 20px 24px;">
                ${data.message}
              </div>

              ${buttonHtml}

              <div style="margin-top: 30px; padding-top: 18px; border-top: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between;">
                <div style="font-size: 13px; color: #64748b;">
                  با احترام،<br />
                  <strong style="color: #0f172a;">${senderTitle}</strong>
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafb; border-top: 1px solid #edf2f4; padding: 20px 30px; text-align: center; font-size: 12px; color: #64748b;">
              <p style="margin: 0 0 6px 0;">
                پشتیبانی ۲۴ ساعته در تلگرام: <a href="https://t.me/${supportTelegram.replace('@', '')}" style="color: #005a71; font-weight: bold; text-decoration: none;">${supportTelegram}</a>
              </p>
              <div style="font-size: 11px; color: #94a3b8;">
                این پیام به صورت اختصاصی برای حساب کاربری شما در ارزان اکانت ارسال شده است.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
سلام ${recipientName}،

${data.message}

${data.buttonUrl ? `لینک: ${data.buttonUrl}` : ''}

با احترام،
${senderTitle}
پشتیبانی تلگرام: https://t.me/${supportTelegram.replace('@', '')}
  `.trim();

  return { html, text, subject };
}
