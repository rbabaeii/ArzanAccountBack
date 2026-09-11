/**
 * Iranian Bank Card and Sheba (IBAN) Validation and Recognition Utility
 */

export function toEnglishDigits(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  const s = String(str);
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  let result = s;
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(persianDigits[i], 'g'), String(i));
    result = result.replace(new RegExp(arabicDigits[i], 'g'), String(i));
  }
  return result;
}

export const CARD_BIN_MAP: Record<string, string> = {
  '603799': 'بانک ملی ایران',
  '589210': 'بانک سپه',
  '627648': 'بانک توسعه صادرات',
  '627961': 'بانک صنعت و معدن',
  '603770': 'بانک کشاورزی',
  '628023': 'بانک مسکن',
  '627760': 'پست بانک ایران',
  '502908': 'بانک توسعه تعاون',
  '627412': 'بانک اقتصاد نوین',
  '622106': 'بانک پارسیان',
  '502229': 'بانک پاسارگاد',
  '627488': 'بانک کارآفرین',
  '621986': 'بانک سامان',
  '639346': 'بانک سینا',
  '639607': 'بانک سرمایه',
  '636214': 'بانک آینده',
  '504706': 'بانک شهر',
  '502806': 'بانک شهر',
  '502938': 'بانک دی',
  '603769': 'بانک صادرات ایران',
  '610433': 'بانک ملت',
  '627353': 'بانک تجارت',
  '589463': 'بانک رفاه کارگران',
  '627381': 'بانک انصار',
  '639347': 'بانک پاسارگاد',
  '505785': 'بانک ایران زمین',
  '636795': 'بانک مرکزی',
  '639599': 'بانک قوامین',
  '505801': 'موسسه اعتباری کوثر',
  '606373': 'بانک قرض‌الحسنه مهر ایران',
  '606256': 'موسسه اعتباری ملل',
  '505416': 'بانک گردشگری',
  '639217': 'بانک کشاورزی',
  '628157': 'موسسه اعتباری توسعه',
  '507677': 'موسسه اعتباری نور',
  '604932': 'بانک قرض‌الحسنه رسالت',
  '505809': 'بانک خاورمیانه',
};

export const SHEBA_BANK_CODE_MAP: Record<string, string> = {
  '010': 'بانک مرکزی',
  '011': 'بانک صنعت و معدن',
  '012': 'بانک ملت',
  '013': 'بانک رفاه کارگران',
  '014': 'بانک مسکن',
  '015': 'بانک سپه',
  '016': 'بانک کشاورزی',
  '017': 'بانک ملی ایران',
  '018': 'بانک تجارت',
  '019': 'بانک صادرات ایران',
  '020': 'بانک توسعه صادرات',
  '021': 'پست بانک ایران',
  '022': 'بانک توسعه تعاون',
  '051': 'موسسه اعتباری توسعه',
  '053': 'بانک کارآفرین',
  '054': 'بانک پارسیان',
  '055': 'بانک اقتصاد نوین',
  '056': 'بانک سامان',
  '057': 'بانک پاسارگاد',
  '058': 'بانک سرمایه',
  '059': 'بانک سینا',
  '060': 'بانک قرض‌الحسنه مهر ایران',
  '061': 'بانک شهر',
  '062': 'بانک آینده',
  '063': 'بانک انصار',
  '064': 'بانک گردشگری',
  '065': 'بانک حکمت ایرانیان',
  '066': 'بانک دی',
  '069': 'بانک ایران زمین',
  '070': 'بانک قرض‌الحسنه رسالت',
  '073': 'موسسه اعتباری کوثر',
  '075': 'موسسه اعتباری ملل',
  '078': 'بانک خاورمیانه',
  '080': 'موسسه اعتباری نور',
};

/**
 * Validate 16-digit Iranian bank card number with Luhn algorithm
 */
export function validateIranianCardNumber(cardNumber: string): { isValid: boolean; bankName?: string; error?: string } {
  if (!cardNumber) {
    return { isValid: false, error: 'شماره کارت بانکی وارد نشده است.' };
  }

  const clean = toEnglishDigits(cardNumber).replace(/\D/g, '');

  if (clean.length !== 16) {
    return { isValid: false, error: 'شماره کارت بانکی باید دقیقاً ۱۶ رقم باشد.' };
  }

  let sum = 0;
  for (let i = 0; i < 16; i++) {
    let digit = parseInt(clean[i], 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  if (sum % 10 !== 0) {
    return { isValid: false, error: 'شماره کارت بانکی نامعتبر است (کنترل چکسام ناموفق بود).' };
  }

  const prefix = clean.substring(0, 6);
  const bankName = CARD_BIN_MAP[prefix] || 'کارت شتاب';

  return { isValid: true, bankName };
}

/**
 * Validate Iranian Sheba (IBAN) with ISO 7064 Mod 97-10 algorithm
 */
export function validateIranianSheba(sheba: string): { isValid: boolean; bankName?: string; formattedSheba?: string; error?: string } {
  if (!sheba) {
    return { isValid: false, error: 'شماره شبا وارد نشده است.' };
  }

  let clean = toEnglishDigits(sheba).replace(/[\s-]/g, '').toUpperCase();
  if (!clean.startsWith('IR')) {
    clean = 'IR' + clean;
  }

  if (clean.length !== 26) {
    return { isValid: false, error: 'شماره شبا باید شامل ۲۴ رقم به همراه پیشوند IR باشد (مجموعاً ۲۶ کاراکتر).' };
  }

  if (!/^IR\d{24}$/.test(clean)) {
    return { isValid: false, error: 'شماره شبا پس از IR فقط باید شامل اعداد باشد.' };
  }

  // Move first 4 characters to the end
  const rearranged = clean.substring(4) + clean.substring(0, 4);

  let numericString = '';
  for (let i = 0; i < rearranged.length; i++) {
    const char = rearranged[i];
    if (char >= 'A' && char <= 'Z') {
      numericString += (char.charCodeAt(0) - 55).toString();
    } else {
      numericString += char;
    }
  }

  // Modulo 97 piece by piece to prevent BigInt overflow issues
  let remainder = 0;
  for (let i = 0; i < numericString.length; i++) {
    remainder = (remainder * 10 + parseInt(numericString[i], 10)) % 97;
  }

  if (remainder !== 1) {
    return { isValid: false, error: 'شماره شبا نامعتبر است (کنترل چکسام بانکی ناموفق بود).' };
  }

  const bankCode = clean.substring(4, 7);
  const bankName = SHEBA_BANK_CODE_MAP[bankCode] || 'حساب بانکی';

  return { isValid: true, bankName, formattedSheba: clean };
}

/**
 * Format 16-digit card number into 4-digit groups (e.g. 6037 9918 1234 5678)
 */
export function formatCardNumber(card: string): string {
  const clean = toEnglishDigits(card).replace(/\D/g, '');
  const parts: string[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    parts.push(clean.substring(i, i + 4));
  }
  return parts.join(' ');
}

/**
 * Format 26-character Sheba into 4-character groups
 */
export function formatSheba(sheba: string): string {
  let clean = toEnglishDigits(sheba).replace(/[\s-]/g, '').toUpperCase();
  if (!clean.startsWith('IR') && clean.length === 24) {
    clean = 'IR' + clean;
  }
  const parts: string[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    parts.push(clean.substring(i, i + 4));
  }
  return parts.join(' ');
}
