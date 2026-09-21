export interface SmsConfig {
  baseUrl: string;
  apiKey: string;
  username: string;
  isEnabled: boolean;
  patternOtp: number;
  patternOrderCreated: number;
  patternOrderCompleted: number;
  patternOrderRefunded: number;
  patternWithdrawalApproved: number;
  patternWalletTopup: number;
}

export interface SendPatternSmsDto {
  to: string;
  bodyId: number;
  args: string[];
  template?: string;
}

export interface SendTestSmsDto {
  to: string;
  bodyId: number;
  args?: string[];
}

export interface PayamakPanelRestResponse {
  Value: string;
  RetStatus: number;
  StrRetStatus: string;
}

export const PAYAMAK_PANEL_ERRORS: Record<string, string> = {
  '-110': 'الزام استفاده از apiKey به جای رمز عبور',
  '-109': 'الزام تنظیم IP مجاز برای استفاده از API',
  '-108': 'مسدود شدن IP به دلیل تلاش ناموفق استفاده از API',
  '-10': 'ممنوعیت ارسال لینک در متغیرها',
  '-6': 'خطای داخلی رخ داده است با پشتیبانی تماس بگیرید.',
  '-5': 'متن ارسالی با توجه به متغیرهای مشخص شده در متن پیشفرض همخوانی ندارد.',
  '-4': 'کد متن ارسالی (bodyId) صحیح نمی‌باشد و یا توسط مدیر سامانه تایید نشده است.',
  '-3': 'خط ارسالی در سیستم تعریف نشده است، با پشتیبانی سامانه تماس بگیرید.',
  '-2': 'محدودیت تعداد شماره، محدودیت هر بار ارسال ۱ شماره موبایل می‌باشد.',
  '-1': 'دسترسی برای استفاده از این وبسرویس غیرفعال است، با پشتیبانی تماس بگیرید.',
  '0': 'نام کاربری یا رمز عبور (ApiKey) صحیح نمی‌باشد.',
  '2': 'اعتبار کافی نمی‌باشد.',
  '6': 'سامانه در حال بروزرسانی می‌باشد.',
  '7': 'متن حاوی کلمه فیلتر شده می‌باشد، با واحد اداری تماس بگیرید.',
  '10': 'کاربر مورد نظر فعال نمی‌باشد.',
  '11': 'ارسال نشده.',
  '12': 'مدارک کاربر کامل نمی‌باشد.',
  '18': 'شماره موبایل معتبر نمی‌باشد.',
  '19': 'سقف محدودیت روزانه ارسال از وبسرویس.',
};
