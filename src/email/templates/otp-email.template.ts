/**
 * High-deliverability OTP Email Template for arzanAccount
 * Adheres strictly to RFC 5322, clean MIME standards, anti-spam guidelines.
 */

export interface OtpEmailData {
  code: string;
  phone: string;
  expiresInMinutes?: number;
  siteUrl?: string;
}

export function renderOtpEmail(data: OtpEmailData): { html: string; text: string; subject: string } {
  const code = data.code.trim();
  const phone = data.phone.trim();
  const minutes = data.expiresInMinutes || 5;
  const siteUrl = data.siteUrl || 'https://arzanaccount.com';

  const subject = `کد تایید ورود به ارزان اکانت: ${code}`;

  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Tahoma, Arial, sans-serif;
      background-color: #f1f5f9;
      color: #0f172a;
      margin: 0;
      padding: 24px 12px;
      direction: rtl;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
      padding: 28px 24px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
    }
    .content {
      padding: 32px 28px;
      text-align: center;
    }
    .code-box {
      background-color: #f8fafc;
      border: 2px dashed #0d9488;
      border-radius: 12px;
      padding: 18px 24px;
      margin: 24px auto;
      display: inline-block;
    }
    .code {
      font-family: monospace;
      font-size: 32px;
      font-weight: 900;
      letter-spacing: 8px;
      color: #0f766e;
    }
    .info-text {
      font-size: 13px;
      line-height: 1.8;
      color: #475569;
      margin: 16px 0;
    }
    .warning {
      font-size: 12px;
      color: #b91c1c;
      background-color: #fef2f2;
      border: 1px solid #fee2e2;
      border-radius: 8px;
      padding: 10px 14px;
      margin-top: 20px;
    }
    .footer {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 16px 24px;
      text-align: center;
      font-size: 11px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ارزان اکانت - تایید هویت</h1>
    </div>
    <div class="content">
      <p class="info-text">
        کاربر گرامی، کد تایید یکبار مصرف شما برای شماره تماس <strong>${phone}</strong> جهت ورود به حساب کاربری:
      </p>
      <div class="code-box">
        <span class="code">${code}</span>
      </div>
      <p class="info-text">
        این کد به مدت <strong>${minutes} دقیقه</strong> معتبر است.
      </p>
      <div class="warning">
        توجه: این کد اختصاصی و محرمانه است. هرگز آن را در اختیار افراد دیگر قرار ندهید.
      </div>
    </div>
    <div class="footer">
      ارزان اکانت | فروشگاه تخصصی لایسنس و اشتراک‌های دیجیتال
      <br>
      <a href="${siteUrl}" style="color: #0d9488; text-decoration: none;">${siteUrl}</a>
    </div>
  </div>
</body>
</html>`;

  const text = `ارزان اکانت - کد تایید ورود
کد تایید ورود برای شماره ${phone}: ${code}
این کد به مدت ${minutes} دقیقه معتبر است.
توجه: این کد محرمانه است و نباید در اختیار شخص دیگری قرار گیرد.
وب‌سایت: ${siteUrl}`;

  return { html, text, subject };
}
