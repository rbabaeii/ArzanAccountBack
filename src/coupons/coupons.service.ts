import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function toEnglishDigits(str: string): string {
  return str
    .replace(/[۰-۹]/g, (d) => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
    .replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
}

function jalaliToGregorian(jy: number, jm: number, jd: number): Date {
  let gy: number;
  if (jy > 979) {
    gy = 1600;
    jy -= 979;
  } else {
    gy = 621;
  }
  let days =
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const gd = days + 1;
  const sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm: number;
  for (gm = 0; gm < 13; gm++) {
    const v = sal_a[gm];
    if (gd <= v) break;
    days -= v;
  }
  return new Date(gy, gm - 1, gd, 23, 59, 59, 999);
}

function isCouponExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  const clean = toEnglishDigits(String(expiresAt)).trim();
  if (!clean) return false;

  const parts = clean.split(/[-/]/);
  if (parts.length >= 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (y >= 1300 && y <= 1500 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const gDate = jalaliToGregorian(y, m, d);
      return gDate.getTime() < Date.now();
    }
  }

  const date = new Date(clean);
  if (!isNaN(date.getTime())) {
    if (!clean.includes(':') && !clean.includes('T')) {
      date.setHours(23, 59, 59, 999);
    }
    return date.getTime() < Date.now();
  }

  return false;
}

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async validateCoupon(code: string, authenticatedUserId?: string, userPhone?: string) {
    if (!code) {
      throw new BadRequestException('کد تخفیف ارسال نشده است.');
    }

    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!coupon) {
      throw new NotFoundException('کد تخفیف نامعتبر است.');
    }

    if (!coupon.isActive) {
      throw new BadRequestException('این کد تخفیف غیرفعال شده است.');
    }

    if (coupon.maxUsage && coupon.usageCount >= coupon.maxUsage) {
      throw new BadRequestException('ظرفیت استفاده از این کد تخفیف به پایان رسیده است.');
    }

    if (coupon.expiresAt && isCouponExpired(coupon.expiresAt)) {
      throw new BadRequestException('مهلت استفاده از این کد تخفیف به پایان رسیده است.');
    }

    if (coupon.allowedUserIds) {
      let allowed: any[] = [];
      try {
        allowed = typeof coupon.allowedUserIds === 'string'
          ? JSON.parse(coupon.allowedUserIds)
          : coupon.allowedUserIds;
      } catch {
        allowed = [coupon.allowedUserIds];
      }

      if (Array.isArray(allowed) && allowed.length > 0) {
        if (!authenticatedUserId && !userPhone) {
          throw new BadRequestException('برای استفاده از این کد تخفیف اختصاصی، ابتدا باید وارد حساب کاربری خود شوید.');
        }

        let userEmail: string | undefined;
        let resolvedPhone: string | undefined = userPhone;

        if (authenticatedUserId && this.prisma.user) {
          const userRec = await this.prisma.user.findUnique({ where: { id: authenticatedUserId } });
          if (userRec) {
            userEmail = userRec.email || undefined;
            if (!resolvedPhone) resolvedPhone = userRec.phone || undefined;
          }
        }

        const matchesUser = allowed.some((target: any) => {
          if (typeof target === 'string') {
            return (
              (authenticatedUserId && target === authenticatedUserId) ||
              (resolvedPhone && target === resolvedPhone) ||
              (userEmail && target.toLowerCase() === userEmail.toLowerCase())
            );
          }
          if (typeof target === 'object' && target !== null) {
            return (
              (authenticatedUserId && target.id === authenticatedUserId) ||
              (resolvedPhone && target.phone === resolvedPhone) ||
              (userEmail && target.email && target.email.toLowerCase() === userEmail.toLowerCase())
            );
          }
          return false;
        });

        if (!matchesUser) {
          throw new BadRequestException('این کد تخفیف مختص کاربران منتخب صادر گردیده است.');
        }

        // Per-user usage limit: Prevent re-use of user-restricted coupons across orders
        const searchConditions: any[] = [];
        if (resolvedPhone) searchConditions.push({ customerPhone: resolvedPhone });
        if (userEmail) searchConditions.push({ customerEmail: userEmail });

        if (searchConditions.length > 0) {
          const existingOrder = await this.prisma.order.findFirst({
            where: {
              couponCode: coupon.code,
              status: { notIn: ['cancelled', 'refunded'] },
              OR: searchConditions,
            },
          });

          if (existingOrder) {
            throw new BadRequestException('شما پیش‌تر از این کد تخفیف اختصاصی استفاده نموده‌اید.');
          }
        }
      }
    }

    return {
      success: true,
      coupon,
    };
  }
}
