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
      direction: rtl !important;
      text-align: right !important;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
      direction: rtl !important;
      text-align: right !important;
    }
    .header {
      background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
      padding: 28px 24px;
      text-align: center !important;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
    }
    .content {
      padding: 32px 28px;
      direction: rtl !important;
      text-align: right !important;
    }
    .code-box {
      background-color: #f8fafc;
      border: 2px dashed #0d9488;
      border-radius: 12px;
      padding: 18px 24px;
      margin: 24px auto;
      text-align: center;
      display: block;
      width: fit-content;
      direction: ltr !important;
    }
    .code {
      font-family: monospace;
      font-size: 32px;
      font-weight: 900;
      letter-spacing: 8px;
      color: #0f766e;
      display: inline-block;
      direction: ltr;
    }
    .info-text {
      font-size: 13.5px;
      line-height: 1.8;
      color: #334155;
      margin: 16px 0;
      direction: rtl !important;
      text-align: right !important;
    }
    .warning {
      font-size: 12px;
      color: #b91c1c;
      background-color: #fef2f2;
      border: 1px solid #fee2e2;
      border-radius: 8px;
      padding: 12px 16px;
      margin-top: 20px;
      direction: rtl !important;
      text-align: right !important;
      line-height: 1.6;
    }
    .footer {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 16px 24px;
      text-align: center !important;
      font-size: 11px;
      color: #64748b;
      direction: rtl !important;
    }
  </style>
</head>
<body dir="rtl" style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Tahoma, Arial, sans-serif; color: #0f172a; direction: rtl !important; text-align: right !important;">
  <div class="container" dir="rtl" style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; direction: rtl !important; text-align: right !important;">
    <div class="header" style="background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff;">ارزان اکانت - تایید هویت</h1>
    </div>
    <div class="content" dir="rtl" style="padding: 32px 28px; direction: rtl !important; text-align: right !important;">
      <p class="info-text" style="font-size: 13.5px; line-height: 1.8; color: #334155; margin: 16px 0; direction: rtl !important; text-align: right !important;">
        کاربر گرامی، کد تایید یکبار مصرف شما برای شماره تماس <strong style="font-family: monospace; direction: ltr; display: inline-block;">${phone}</strong> جهت ورود به حساب کاربری:
      </p>
      <div class="code-box" style="background-color: #f8fafc; border: 2px dashed #0d9488; border-radius: 12px; padding: 18px 24px; margin: 24px auto; text-align: center; width: fit-content; direction: ltr;">
        <span class="code" style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #0f766e; display: inline-block; direction: ltr;">${code}</span>
      </div>
      <p class="info-text" style="font-size: 13.5px; line-height: 1.8; color: #334155; margin: 16px 0; direction: rtl !important; text-align: right !important;">
        این کد به مدت <strong>${minutes} دقیقه</strong> معتبر است.
      </p>
      <div class="warning" style="font-size: 12px; color: #b91c1c; background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 12px 16px; margin-top: 20px; direction: rtl !important; text-align: right !important; line-height: 1.6;">
        ⚠️ توجه: این کد اختصاصی و محرمانه است. هرگز آن را در اختیار افراد دیگر قرار ندهید.
      </div>
    </div>
    <div class="footer" style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11px; color: #64748b; direction: rtl;">
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
