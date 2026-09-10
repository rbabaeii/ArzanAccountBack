/**
 * Test SMTP Email Template (Diagnostic Verification)
 */

export interface TestEmailData {
  host: string;
  port: number;
  user: string;
  fromName: string;
  fromEmail: string;
  sentAt: string;
  serverTime: string;
}

export function renderTestEmail(data: TestEmailData): { html: string; text: string; subject: string } {
  const subject = 'تست موفقیت‌آمیز اتصال سرور ایمیل - ارزان اکانت';

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body dir="rtl" style="margin: 0; padding: 24px 10px; background-color: #f1f5f9; font-family: 'Vazirmatn', Tahoma, Arial, sans-serif; color: #101d22; direction: rtl !important; text-align: right !important;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" dir="rtl" style="direction: rtl !important; text-align: right !important;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" dir="rtl" style="max-width: 560px; background-color: #ffffff; border-radius: 14px; border: 1px solid #e2edf1; overflow: hidden; box-shadow: 0 4px 16px rgba(0,65,83,0.06); direction: rtl !important; text-align: right !important;">
          <tr>
            <td height="5" style="background: linear-gradient(90deg, #059669 0%, #10b981 100%);"></td>
          </tr>
          <tr>
            <td style="padding: 24px 28px;">
              <div style="display: flex; align-items: center; margin-bottom: 14px;">
                <div style="width: 36px; height: 36px; border-radius: 50%; background-color: #ecfdf5; border: 1px solid #a7f3d0; text-align: center; line-height: 36px; font-size: 20px; color: #059669;">
                  ✓
                </div>
                <div style="padding-right: 12px;">
                  <h1 style="margin: 0; font-size: 18px; color: #065f46; font-weight: bold;">
                    تست اتصال سرور SMTP موفقیت‌آمیز بود!
                  </h1>
                </div>
              </div>

              <p style="font-size: 13.5px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
                این یک پیام تستی از پنل مدیریت سامانه <strong>ارزان اکانت</strong> است. پیکربندی سرور SMTP و احراز هویت با موفقیت انجام شده و ایمیل‌ها آماده ارسال می‌باشند.
              </p>

              <!-- Diagnostic Info Table -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12.5px; margin-bottom: 16px;">
                <tr>
                  <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">سرور SMTP:</td>
                  <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; text-align: left; direction: ltr;">${data.host}:${data.port}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">اکانت فرستنده:</td>
                  <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; text-align: left; direction: ltr;">${data.fromName} &lt;${data.fromEmail}&gt;</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; color: #64748b;">زمان ارسال سرور:</td>
                  <td style="padding: 8px 12px; font-family: monospace; text-align: left; direction: ltr;">${data.sentAt}</td>
                </tr>
              </table>

              <div style="font-size: 12px; color: #059669; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px;">
                ✓ هدرهای ضد اسپم، نام نمایشی، و ساختار چندبخشی (MIME) با موفقیت اعتبارسنجی شدند.
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
تست اتصال سرور SMTP موفقیت‌آمیز بود!
سرور: ${data.host}:${data.port}
اکانت فرستنده: ${data.fromName} <${data.fromEmail}>
زمان: ${data.sentAt}
ارزان اکانت (Arzan Account)
  `.trim();

  return { html, text, subject };
}
