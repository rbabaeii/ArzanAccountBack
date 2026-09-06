import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

interface StoredOtp {
  code: string;
  expiresAt: number;
}

@Injectable()
export class AuthService {
  // In-memory OTP storage: phone -> { code, expiresAt }
  private otpMap = new Map<string, StoredOtp>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async sendOtp(phone: string): Promise<{ success: boolean; message: string }> {
    const cleanPhone = phone.trim();

    // Default mock test code is '11111'
    let otpCode = '11111';

    // Store in OTP map with 5 minutes validity
    this.otpMap.set(cleanPhone, {
      code: otpCode,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    console.log(`[AUTH OTP] Sent code ${otpCode} to phone ${cleanPhone}`);

    return {
      success: true,
      message: `کد تایید پیامک شد. (کد آزمایشی برای کلیه شماره‌ها: ${otpCode})`,
    };
  }

  async verifyOtp(
    phone: string,
    code: string,
  ): Promise<{ accessToken: string; user: any }> {
    const cleanPhone = phone.trim();
    const cleanCode = code.trim();

    const record = this.otpMap.get(cleanPhone);

    // Accept 11111 for test numbers, or matching stored code
    const isMockAccepted =
      cleanCode === '11111' ||
      (record && record.code === cleanCode && record.expiresAt > Date.now());

    if (!isMockAccepted) {
      throw new BadRequestException('کد تایید وارد شده نامعتبر است یا منقضی شده است.');
    }

    // Remove OTP once verified
    this.otpMap.delete(cleanPhone);

    // Find or create user
    let user = await this.prisma.user.findFirst({
      where: { phone: cleanPhone },
    });

    // Special test numbers
    const isSuperAdminPhone = cleanPhone === '09181111111';
    const isDefaultUserPhone = cleanPhone === '09180000000';

    if (!user) {
      let role = 'USER';
      let name = `کاربر ${cleanPhone.slice(-4)}`;

      if (isSuperAdminPhone) {
        role = 'SUPER_ADMIN';
        name = 'مدیر ارشد سامانه (09181111111)';
      } else if (isDefaultUserPhone) {
        role = 'USER';
        name = 'کاربر عادی فروشگاه (09180000000)';
      }

      user = await this.prisma.user.create({
        data: {
          phone: cleanPhone,
          name,
          role,
          status: 'ACTIVE',
          walletBalanceToman: isSuperAdminPhone ? 1000000 : 0,
          isTwoFactorEnabled: isSuperAdminPhone,
          lastLoginAt: new Date(),
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'ثبت‌نام کاربر جدید با OTP',
          details: `کاربر با شماره ${cleanPhone} و نقش ${role} در سیستم ثبت شد.`,
          user: cleanPhone,
          type: 'security',
        },
      });
    } else {
      // Ensure super admin phone always has SUPER_ADMIN role
      if (isSuperAdminPhone && user.role !== 'SUPER_ADMIN') {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { role: 'SUPER_ADMIN' },
        });
      }

      // Update last login timestamp
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'ورود موفق کاربر با OTP',
          details: `کاربر با شماره ${cleanPhone} (نقش: ${user.role}) وارد سیستم شد.`,
          user: cleanPhone,
          type: 'security',
        },
      });
    }

    if (user.status === 'BLOCKED') {
      throw new UnauthorizedException(
        'حساب کاربری شما مسدود شده است. لطفاً با پشتیبانی تماس بگیرید.',
      );
    }

    // Generate JWT token
    const payload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name,
      status: user.status,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        status: user.status,
        walletBalanceToman: user.walletBalanceToman,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
        avatar: user.avatar,
        lastLoginAt: user.lastLoginAt,
      },
    };
  }

  async getMe(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        walletBalanceToman: true,
        isTwoFactorEnabled: true,
        avatar: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('کاربر یافت نشد.');
    }

    return user;
  }
}
