import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';
import {
  validateIranianCardNumber,
  validateIranianSheba,
  formatCardNumber,
  formatSheba,
} from '../common/utils/iranian-banks';
import { CreateUserDto, UpdateUserRoleDto, UpdateUserStatusDto, UpdateProfileDto, CreateWithdrawalDto, ProcessWithdrawalDto } from './users.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) {}

  sanitizeUser(user: any) {
    if (!user) return null;
    const { password, ...safeUser } = user;
    return safeUser;
  }

  async getUsers(params?: {
    role?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (params?.role && params.role !== 'all') {
      where.role = params.role;
    }

    if (params?.status && params.status !== 'all') {
      where.status = params.status;
    }

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search } },
        { email: { contains: params.search } },
        { phone: { contains: params.search } },
      ];
    }

    const [users, totalCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        take: Math.min(100, Math.max(1, Number(params?.limit) || 50)),
        skip: Math.max(0, Number(params?.offset) || 0),
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => this.sanitizeUser(u)),
      totalCount,
    };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('کاربر یافت نشد.');
    return this.sanitizeUser(user);
  }

  async getUserStats() {
    const [totalUsers, activeUsers, totalAdmins, twoFactorCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { role: { not: 'USER' } } }),
      this.prisma.user.count({ where: { isTwoFactorEnabled: true } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalAdmins,
      twoFactorCount,
    };
  }

  async createUser(dto: CreateUserDto, author = 'مدیر سیستم') {
    const hashedPassword = dto.password ? bcrypt.hashSync(dto.password, 10) : null;
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        password: hashedPassword,
        role: dto.role || 'USER',
        status: dto.status || 'ACTIVE',
        isTwoFactorEnabled: dto.isTwoFactorEnabled ?? false,
        avatar: dto.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: `ایجاد کاربر / مدیر جدید (${user.name})`,
        details: `کاربر با نقش ${user.role} توسط ${author} ایجاد شد.`,
        user: author,
        type: 'security',
      },
    });

    return this.sanitizeUser(user);
  }

  async updateUserRole(id: string, dto: UpdateUserRoleDto, author = 'مدیر سیستم') {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('کاربر یافت نشد.');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
    });

    await this.prisma.auditLog.create({
      data: {
        action: `تغییر سطح دسترسی کاربر (${user.name})`,
        details: `نقش کاربری از ${user.role} به ${dto.role} تغییر یافت.`,
        user: author,
        type: 'security',
      },
    });

    return this.sanitizeUser(updated);
  }

  async updateUserStatus(id: string, dto: UpdateUserStatusDto, author = 'مدیر سیستم') {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('کاربر یافت نشد.');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.prisma.auditLog.create({
      data: {
        action: `تغییر وضعیت حساب کاربر (${user.name})`,
        details: `وضعیت حساب به ${dto.status === 'ACTIVE' ? 'فعال' : 'مسدود'} تغییر یافت.`,
        user: author,
        type: 'security',
      },
    });

    return this.sanitizeUser(updated);
  }

  async deleteUser(id: string, authorAdmin?: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('کاربر یافت نشد.');

    const authorId = typeof authorAdmin === 'string' ? authorAdmin : (authorAdmin?.id || authorAdmin?.sub);
    if (authorId && authorId === id) {
      throw new BadRequestException('امکان حذف حساب کاربری خودتان وجود ندارد.');
    }

    if (user.role === 'SUPER_ADMIN') {
      const superAdminCount = await this.prisma.user.count({ where: { role: 'SUPER_ADMIN' } });
      if (superAdminCount <= 1) {
        throw new BadRequestException('امکان حذف آخرین مدیر ارشد سامانه وجود ندارد.');
      }
    }

    // Safely remove any dependent withdrawal requests to prevent P2003 FK constraint crash
    await this.prisma.withdrawalRequest.deleteMany({ where: { userId: id } });

    await this.prisma.user.delete({ where: { id } });

    const authorName = typeof authorAdmin === 'string' ? authorAdmin : (authorAdmin?.name || authorAdmin?.phone || 'مدیر ارشد');

    await this.prisma.auditLog.create({
      data: {
        action: `حذف حساب کاربری (${user.name})`,
        details: `حساب کاربری ${user.name} (${user.email || user.phone}) حذف گردید.`,
        user: authorName,
        type: 'security',
      },
    });

    return { success: true, message: 'کاربر با موفقیت حذف شد.' };
  }

  async getAdminActivities(params?: {
    adminId?: string;
    adminUser?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    sort?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (params?.adminId && params.adminId !== 'all') {
      const admin = await this.prisma.user.findUnique({ where: { id: params.adminId } });
      if (admin) {
        where.OR = [
          { adminId: admin.id },
          { user: { contains: admin.name } },
          { user: { contains: admin.phone || '____' } },
        ];
      } else {
        where.adminId = params.adminId;
      }
    }

    if (params?.type && params.type !== 'all') {
      where.type = params.type;
    }

    if (params?.search) {
      const s = params.search.trim();
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { action: { contains: s } },
          { details: { contains: s } },
          { user: { contains: s } },
        ],
      });
    }

    if (params?.startDate || params?.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        const end = new Date(params.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const sortOrder = params?.sort === 'asc' ? 'asc' : 'desc';

    const [activities, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: sortOrder },
        take: Math.min(100, Math.max(1, Number(params?.limit) || 50)),
        skip: Math.max(0, Number(params?.offset) || 0),
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      activities,
      total,
    };
  }

  async getAdminActivitySummary(adminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('مدیر یافت نشد.');

    const adminWhere: any = {
      OR: [
        { adminId: admin.id },
        { user: { contains: admin.name } },
        { user: { contains: admin.phone || '____' } },
      ],
    };

    const [totalActivities, orderApprovals, catalogActions, lastActivity] = await Promise.all([
      this.prisma.auditLog.count({ where: adminWhere }),
      this.prisma.auditLog.count({
        where: {
          ...adminWhere,
          type: { in: ['order', 'order_approval', 'order_delivery'] },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          ...adminWhere,
          type: { in: ['product_update', 'product_toggle', 'category_update'] },
        },
      }),
      this.prisma.auditLog.findFirst({
        where: adminWhere,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const approvedOrders = await this.prisma.order.findMany({
      where: {
        OR: [
          { approvedByAdminId: admin.id },
          { approvedByAdminName: { contains: admin.name } },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        totalPriceToman: true,
        totalPriceUsd: true,
        approvedAt: true,
      },
    });

    const approvedOrdersTotalToman = approvedOrders.reduce((sum, o) => sum + o.totalPriceToman, 0);

    return {
      admin: {
        id: admin.id,
        name: admin.name,
        role: admin.role,
        phone: admin.phone,
        email: admin.email,
        status: admin.status,
        lastLoginAt: admin.lastLoginAt,
        createdAt: admin.createdAt,
      },
      stats: {
        totalActivities,
        orderApprovals: Math.max(orderApprovals, approvedOrders.length),
        catalogActions,
        approvedOrdersCount: approvedOrders.length,
        approvedOrdersTotalToman,
        lastActivityAt: lastActivity ? lastActivity.createdAt : admin.lastLoginAt,
      },
    };
  }

  async updateProfile(id: string, dto: UpdateProfileDto, authorAdmin?: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('کاربر یافت نشد.');

    const dataToUpdate: any = {};
    if (dto.name !== undefined) dataToUpdate.name = dto.name.trim();
    if (dto.email !== undefined) {
      const cleanEmail = dto.email?.trim().toLowerCase() || null;
      if (cleanEmail && cleanEmail !== user.email) {
        const existingEmail = await this.prisma.user.findFirst({
          where: { email: cleanEmail, id: { not: id } },
        });
        if (existingEmail) {
          throw new BadRequestException('این آدرس ایمیل پیش‌تر برای کاربر دیگری ثبت شده است.');
        }
      }
      dataToUpdate.email = cleanEmail;
    }
    if (dto.phone !== undefined) {
      const cleanPhone = dto.phone?.trim() || null;
      if (cleanPhone && cleanPhone !== user.phone) {
        // Enforce anti-account-takeover guard: regular users cannot directly hijack or change primary login phone without 2FA
        const isSuperAdmin = authorAdmin && authorAdmin.role === 'SUPER_ADMIN';
        if (!isSuperAdmin) {
          throw new BadRequestException('امکان تغییر مستقیم شماره تلفن همراه وجود ندارد. جهت تغییر شماره ورود، لطفاً با پشتیبانی سامانه هماهنگ فرمایید.');
        }
        const existingPhone = await this.prisma.user.findFirst({
          where: { phone: cleanPhone, id: { not: id } },
        });
        if (existingPhone) {
          throw new BadRequestException('این شماره تلفن همراه پیش‌تر برای کاربر دیگری ثبت شده است.');
        }
        dataToUpdate.phone = cleanPhone;
      }
    }
    if (dto.nationalCode !== undefined) dataToUpdate.nationalCode = dto.nationalCode?.trim() || null;
    if (dto.birthDate !== undefined) dataToUpdate.birthDate = dto.birthDate?.trim() || null;
    if (dto.jobTitle !== undefined) dataToUpdate.jobTitle = dto.jobTitle?.trim() || null;
    if (dto.avatar !== undefined) dataToUpdate.avatar = dto.avatar?.trim() || null;
    if (dto.bankCardsJson !== undefined) dataToUpdate.bankCardsJson = dto.bankCardsJson;
    if (dto.addressesJson !== undefined) dataToUpdate.addressesJson = dto.addressesJson;
    if (dto.isTwoFactorEnabled !== undefined) dataToUpdate.isTwoFactorEnabled = Boolean(dto.isTwoFactorEnabled);

    const updated = await this.prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'ویرایش مشخصات نمایه کاربر',
        details: `مشخصات کاربری ${updated.name} به‌روزرسانی شد.`,
        user: updated.name,
        type: 'profile_update',
      },
    });

    return this.sanitizeUser(updated);
  }

  async topUpWallet(id: string, amountToman: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('کاربر یافت نشد.');

    const addAmount = Math.max(0, amountToman);
    const newDirect = (user.directDepositBalance || 0) + addAmount;
    const newBonus = user.cashbackBonusBalance || 0;
    const newTotal = newDirect + newBonus;

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        directDepositBalance: newDirect,
        walletBalanceToman: newTotal,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'شارژ مستقیم کیف پول کاربر',
        details: `مبلغ ${new Intl.NumberFormat('fa-IR').format(addAmount)} تومان واریز مستقیم به کیف پول کاربر ${user.name} افزوده شد. موجودی واریزی: ${newDirect} تومان. موجودی کل: ${newTotal} تومان.`,
        user: user.name,
        type: 'finance',
      },
    });

    if (user.phone) {
      this.smsService
        .sendWalletTopupSms(user.phone, addAmount)
        .catch((err) => this.logger.warn(`Failed to send wallet topup SMS to ${user.phone}: ${err?.message}`));
    }

    return this.sanitizeUser(updated);
  }

  /**
   * User submits a withdrawal request.
   * Enforces:
   * 1. Active User Status Guard
   * 2. Pending Requests Throttle (max 1 active pending request)
   * 3. Amount Boundaries (Min 50,000 Toman, Max 50,000,000 Toman)
   * 4. Available Direct Deposit Balance Guard
   * 5. Destination Validation (Luhn for Card, ISO 7064 Mod 97-10 for Sheba)
   * 6. Account Owner Name Guard
   * 7. ATOMIC BALANCE DEDUCTION & HOLD (Double-Spending Prevention)
   */
  async requestWithdrawal(userId: string, dto: CreateWithdrawalDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('کاربر یافت نشد.');

    // 1. User Active Status Guard
    if (user.status !== 'ACTIVE') {
      throw new BadRequestException('حساب کاربری شما فعال نیست و امکان ثبت درخواست تسویه حساب وجود ندارد.');
    }

    // 2. Pending Request Throttle Guard
    const existingPending = await this.prisma.withdrawalRequest.findFirst({
      where: { userId, status: 'PENDING' },
    });
    if (existingPending) {
      throw new BadRequestException(
        `شما یک درخواست تسویه در حال بررسی دارید (#${existingPending.id.slice(-6).toUpperCase()}). لطفاً تا تعیین تکلیف نهایی آن توسط واحد مالی شکیبا باشید.`
      );
    }

    // 3. Amount Boundaries
    const amount = Math.floor(Number(dto.amountToman));
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('مبلغ درخواستی برای تسویه حساب نامعتبر است.');
    }
    if (amount < 50000) {
      throw new BadRequestException('حداقل مبلغ قابل تسویه ۵۰,۰۰۰ تومان می‌باشد.');
    }
    if (amount > 50000000) {
      throw new BadRequestException('حداکثر سقف مجاز تسویه در هر تراکنش ۵۰,۰۰۰,۰۰۰ تومان می‌باشد.');
    }

    // 4. Available Direct Deposit Balance Guard
    const maxWithdrawable = user.directDepositBalance || 0;
    if (amount > maxWithdrawable) {
      throw new BadRequestException(
        `حداکثر سقف مجاز تسویه وجه برای شما ${new Intl.NumberFormat('fa-IR').format(maxWithdrawable)} تومان است. مبالغ هدیه و کش‌بک (${new Intl.NumberFormat('fa-IR').format(user.cashbackBonusBalance || 0)} تومان) تنها برای خرید محصولات سایت قابل استفاده بوده و امکان برداشت نقدی ندارند.`
      );
    }

    // 5. Destination Validation & Banking Checksums
    if (!dto.cardNumber && !dto.sheba) {
      throw new BadRequestException('ثبت حداقل یکی از مشخصات شماره شبا یا شماره کارت جهت واریز وجه الزامی است.');
    }

    let detectedBankName = 'شتاب / بانکی';
    let formattedCard: string | null = null;
    let formattedShebaStr: string | null = null;

    if (dto.cardNumber && dto.cardNumber.trim()) {
      const cardRes = validateIranianCardNumber(dto.cardNumber);
      if (!cardRes.isValid) {
        throw new BadRequestException(cardRes.error || 'شماره کارت بانکی نامعتبر است.');
      }
      formattedCard = formatCardNumber(dto.cardNumber);
      if (cardRes.bankName) detectedBankName = cardRes.bankName;
    }

    if (dto.sheba && dto.sheba.trim()) {
      const shebaRes = validateIranianSheba(dto.sheba);
      if (!shebaRes.isValid) {
        throw new BadRequestException(shebaRes.error || 'شماره شبا نامعتبر است.');
      }
      formattedShebaStr = shebaRes.formattedSheba!;
      if (shebaRes.bankName) detectedBankName = shebaRes.bankName;
    }

    // 6. Account Owner Name Guard
    const ownerName = (dto.accountOwnerName || user.name || '').trim();
    if (!ownerName || ownerName.length < 3) {
      throw new BadRequestException('نام و نام‌خانوادگی صاحب حساب الزامی است (حداقل ۳ حرف).');
    }

    // 7. Atomic Balance Deduction & Hold (Guaranteed Double-Spending & Race Condition Prevention)
    const result = await this.prisma.$transaction(async (tx) => {
      // Re-verify pending request inside the transaction to eliminate race window
      const pendingInTx = await tx.withdrawalRequest.findFirst({
        where: { userId, status: 'PENDING' },
      });
      if (pendingInTx) {
        throw new BadRequestException(
          `شما یک درخواست تسویه در حال بررسی دارید (#${pendingInTx.id.slice(-6).toUpperCase()}). لطفاً تا تعیین تکلیف نهایی آن توسط واحد مالی شکیبا باشید.`
        );
      }

      // Atomic conditional decrement: only succeeds if directDepositBalance >= amount, status == ACTIVE, and no active pending withdrawal
      const updateResult = await tx.user.updateMany({
        where: {
          id: userId,
          directDepositBalance: { gte: amount },
          status: 'ACTIVE',
          OR: [
            { hasPendingWithdrawal: false },
            { hasPendingWithdrawal: null },
          ],
        },
        data: {
          directDepositBalance: { decrement: amount },
          walletBalanceToman: { decrement: amount },
          hasPendingWithdrawal: true,
        },
      });

      if (updateResult.count === 0) {
        const currentUser = await tx.user.findUnique?.({ where: { id: userId } });
        if (currentUser?.hasPendingWithdrawal) {
          throw new BadRequestException('شما یک درخواست تسویه در حال بررسی دارید. لطفاً تا تعیین تکلیف نهایی آن توسط واحد مالی شکیبا باشید.');
        }
        throw new BadRequestException('موجودی مستقیم قابل تسویه شما کافی نیست یا تراکنش دیگری در حال انجام است.');
      }

      const newRequest = await tx.withdrawalRequest.create({
        data: {
          userId,
          amountToman: amount,
          cardNumber: formattedCard,
          sheba: formattedShebaStr,
          bankName: detectedBankName,
          accountOwnerName: ownerName,
          userNote: dto.userNote?.trim() || null,
          status: 'PENDING',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              walletBalanceToman: true,
              directDepositBalance: true,
              cashbackBonusBalance: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'ثبت و قفل موجودی جهت تسویه حساب',
          details: `کاربر ${user.name} درخواست تسویه مبلغ ${new Intl.NumberFormat('fa-IR').format(amount)} تومان به مقصد ${detectedBankName} را ثبت نمود. مبلغ از کیف پول کسر و قفل گردید.`,
          user: user.name,
          type: 'finance',
        },
      });

      return newRequest;
    });

    this.logger.log(`Withdrawal request created for user ${user.id}: ${amount} Toman (locked).`);
    return result;
  }

  /**
   * Get user's own withdrawal requests
   */
  async getUserWithdrawals(userId: string) {
    return this.prisma.withdrawalRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Admin: List all withdrawal requests with user balance breakdown and filtering
   */
  async getAdminWithdrawals(params?: {
    status?: string;
    userId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (params?.status && params.status !== 'all') {
      where.status = params.status;
    }
    if (params?.userId) {
      where.userId = params.userId;
    }
    if (params?.search) {
      const q = params.search.trim();
      where.OR = [
        { user: { name: { contains: q } } },
        { user: { phone: { contains: q } } },
        { user: { email: { contains: q } } },
        { cardNumber: { contains: q } },
        { sheba: { contains: q } },
        { bankTrackingCode: { contains: q } },
        { accountOwnerName: { contains: q } },
      ];
    }

    const [requests, totalCount] = await Promise.all([
      this.prisma.withdrawalRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              walletBalanceToman: true,
              directDepositBalance: true,
              cashbackBonusBalance: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(100, Math.max(1, Number(params?.limit) || 50)),
        skip: Math.max(0, Number(params?.offset) || 0),
      }),
      this.prisma.withdrawalRequest.count({ where }),
    ]);

    return {
      requests,
      totalCount,
    };
  }

  /**
   * Admin: Process (Approve or Reject) a withdrawal request
   * Enforces:
   * 1. Request existence and PENDING state guard
   * 2. If APPROVE: bankTrackingCode required, updates status, dispatches automated email
   * 3. If REJECT: adminNote required, ATOMIC BALANCE RESTORATION, dispatches automated email
   */
  async processWithdrawal(id: string, dto: ProcessWithdrawalDto, adminUser?: any) {
    const request = await this.prisma.withdrawalRequest.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!request) throw new NotFoundException('درخواست تسویه یافت نشد.');

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        `این درخواست قبلاً تعیین تکلیف شده است (وضعیت فعلی: ${request.status === 'APPROVED' ? 'تایید شده' : 'رد شده'}).`
      );
    }

    const adminName = adminUser
      ? (adminUser.name || adminUser.phone || adminUser.email || 'مدیر مالی')
      : (dto.adminName || 'مدیر مالی');
    const adminId = adminUser ? (adminUser.id || adminUser.sub || null) : (dto.adminId || null);

    if (dto.action === 'APPROVE') {
      if (!dto.bankTrackingCode || !dto.bankTrackingCode.trim()) {
        throw new BadRequestException('ثبت کد رهگیری بانکی یا شماره سند واریز برای تایید الزامی است.');
      }

      const trackingCode = dto.bankTrackingCode.trim();
      const receiptUrl = dto.bankReceiptUrl?.trim() || null;

      const updatedRequest = await this.prisma.$transaction(async (tx) => {
        const updateRes = await tx.withdrawalRequest.updateMany({
          where: { id, status: 'PENDING' },
          data: {
            status: 'APPROVED',
            adminNote: dto.adminNote?.trim() || null,
            bankTrackingCode: trackingCode,
            bankReceiptUrl: receiptUrl,
            processedByAdminName: adminName,
            processedByAdminId: adminId,
            processedAt: new Date(),
          },
        });

        if (updateRes.count === 0) {
          throw new BadRequestException('این درخواست تسویه قبلاً تعیین تکلیف شده است.');
        }

        // Release pending hold on user
        await tx.user.update({
          where: { id: request.userId },
          data: { hasPendingWithdrawal: false },
        });

        return tx.withdrawalRequest.findUnique({ where: { id }, include: { user: true } });
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'تایید و تسویه نهایی درخواست برداشت وجه',
          details: `درخواست برداشت ${new Intl.NumberFormat('fa-IR').format(request.amountToman)} تومان کاربر ${request.user.name} توسط ${adminName} تایید و تسویه شد. کد رهگیری: ${trackingCode}.`,
          user: adminName,
          adminId,
          adminName,
          type: 'finance',
        },
      });

      // Send automated approval notification email to user (non-blocking)
      if (request.user?.email && request.user.email.includes('@')) {
        this.emailService
          .sendWithdrawalStatusEmail({
            recipientEmail: request.user.email,
            customerName: request.user.name,
            amountToman: request.amountToman,
            status: 'APPROVED',
            bankName: request.bankName || undefined,
            destination: request.sheba || request.cardNumber || undefined,
            bankTrackingCode: trackingCode,
            bankReceiptUrl: receiptUrl || undefined,
          })
          .catch((err) => {
            this.logger.warn(`Failed to send withdrawal approval email to ${request.user.email}: ${err?.message}`);
          });
      }

      // Send automated approval SMS to user
      if (request.user?.phone) {
        this.smsService
          .sendWithdrawalApprovedSms(
            request.user.phone,
            request.amountToman,
            trackingCode,
          )
          .catch((err) => {
            this.logger.warn(`Failed to send withdrawal approval SMS to ${request.user.phone}: ${err?.message}`);
          });
      }

      return updatedRequest;
    } else {
      // REJECT: Rejection note is strictly required
      if (!dto.adminNote || !dto.adminNote.trim() || dto.adminNote.trim().length < 3) {
        throw new BadRequestException('ثبت دلیل رد درخواست جهت اطلاع کاربر الزامی است.');
      }

      const rejectionReason = dto.adminNote.trim();

      // ATOMIC TRANSACTION: Restore held funds back to user balances ONLY if status is still PENDING
      const updatedRequest = await this.prisma.$transaction(async (tx) => {
        const updateRes = await tx.withdrawalRequest.updateMany({
          where: { id, status: 'PENDING' },
          data: {
            status: 'REJECTED',
            adminNote: rejectionReason,
            processedByAdminName: adminName,
            processedByAdminId: adminId,
            processedAt: new Date(),
          },
        });

        if (updateRes.count === 0) {
          throw new BadRequestException('این درخواست تسویه قبلاً تعیین تکلیف شده است.');
        }

        // Restore directDepositBalance, walletBalanceToman, and release pending hold
        await tx.user.update({
          where: { id: request.userId },
          data: {
            directDepositBalance: { increment: request.amountToman },
            walletBalanceToman: { increment: request.amountToman },
            hasPendingWithdrawal: false,
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'رد درخواست تسویه وجه و بازگشت موجودی به کیف پول',
            details: `درخواست برداشت ${new Intl.NumberFormat('fa-IR').format(request.amountToman)} تومان کاربر ${request.user.name} توسط ${adminName} رد شد و مبلغ به کیف پول کاربر بازگردانده شد. علت: ${rejectionReason}.`,
            user: adminName,
            adminId,
            adminName,
            type: 'finance',
          },
        });

        return tx.withdrawalRequest.findUnique({ where: { id }, include: { user: true } });
      });

      // Send automated rejection notification email to user (non-blocking)
      if (request.user?.email && request.user.email.includes('@')) {
        this.emailService
          .sendWithdrawalStatusEmail({
            recipientEmail: request.user.email,
            customerName: request.user.name,
            amountToman: request.amountToman,
            status: 'REJECTED',
            bankName: request.bankName || undefined,
            destination: request.sheba || request.cardNumber || undefined,
            rejectionReason,
          })
          .catch((err) => {
            this.logger.warn(`Failed to send withdrawal rejection email to ${request.user.email}: ${err?.message}`);
          });
      }

      // Send automated rejection SMS to user
      if (request.user?.phone) {
        this.smsService.getSmsConfig().then((cfg) => {
          if (cfg.patternWithdrawalApproved) {
            this.smsService
              .sendPatternSms(
                request.user.phone!,
                cfg.patternWithdrawalApproved,
                [new Intl.NumberFormat('fa-IR').format(request.amountToman), rejectionReason],
                'withdrawal_rejected',
              )
              .catch((err) => {
                this.logger.warn(`Failed to send withdrawal rejection SMS to ${request.user.phone}: ${err?.message}`);
              });
          }
        });
      }

      return updatedRequest;
    }
  }

  async convertPoints(id: string, rawPoints: number) {
    const points = Math.floor(Number(rawPoints));
    if (isNaN(points) || points < 10) {
      throw new BadRequestException('حداقل امتیاز مجاز برای تبدیل ۱۰ امتیاز می‌باشد.');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('کاربر یافت نشد.');

    const currentPoints = user.clubPoints || 0;
    if (currentPoints < points) {
      throw new BadRequestException('امتیاز کلاب شما برای این تبدیل کافی نیست.');
    }

    const remainingPoints = currentPoints - points;
    const discountPercent = Math.min(30, Math.max(5, Math.floor(points / 10)));
    const couponCode = `CLUB-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Concurrency & Double-spending Guard: Atomic decrement if user.updateMany exists
    if (this.prisma.user.updateMany) {
      const updateResult = await this.prisma.user.updateMany({
        where: {
          id,
          clubPoints: { gte: points },
        },
        data: {
          clubPoints: { decrement: points },
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException('امتیاز کلاب شما برای این تبدیل کافی نیست.');
      }
    } else {
      await this.prisma.user.update({
        where: { id },
        data: { clubPoints: remainingPoints },
      });
    }

    const createdCoupon = await this.prisma.coupon.create({
      data: {
        code: couponCode,
        discountPercent,
        maxDiscountToman: 200000,
        minOrderToman: 100000,
        maxUsage: 1,
        isActive: true,
        allowedUserIds: JSON.stringify([id]),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });

    const updated = await this.prisma.user.findUnique({ where: { id } });

    return {
      user: this.sanitizeUser(updated) || this.sanitizeUser({ ...user, clubPoints: remainingPoints }),
      coupon: {
        code: couponCode,
        discountPercent,
        pointsUsed: points,
      },
    };
  }

  async bindReferral(userId: string, referralCodeInput: string) {
    if (!referralCodeInput || !referralCodeInput.trim()) {
      throw new BadRequestException('کد معرف نمی‌تواند خالی باشد.');
    }
    const cleanRef = referralCodeInput.trim().toUpperCase();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('کاربر یافت نشد.');

    if (user.referredByCode) {
      throw new BadRequestException('شما قبلاً کد معرف ثبت کرده‌اید و هر کاربر منحصراً می‌تواند زیرمجموعه یک معرف باشد.');
    }

    if (user.referralCode && user.referralCode.toUpperCase() === cleanRef) {
      throw new BadRequestException('نمی‌توانید از کد معرف اختصاصی خودتان استفاده کنید.');
    }

    const inviter = await this.prisma.user.findFirst({
      where: {
        OR: [
          { referralCode: cleanRef },
          { id: cleanRef.replace('ARZAN-', '').toLowerCase() },
        ],
      },
    });

    if (!inviter || inviter.id === user.id) {
      throw new BadRequestException('کد معرف وارد شده نامعتبر است یا کاربری با این کد یافت نشد.');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { referredByCode: inviter.referralCode || cleanRef },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'ثبت کد معرف برای حساب کاربری',
        details: `کاربر ${user.name} کد معرف ${inviter.name} (${inviter.referralCode}) را به عنوان معرف خود ثبت نمود.`,
        user: user.phone || user.name || 'User',
        type: 'referral',
      },
    });

    return this.sanitizeUser(updated);
  }

  /**
   * Get user's referral network: referred users list and earnings per user
   */
  async getReferralNetwork(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('کاربر یافت نشد.');

    const referralCode = user.referralCode || `ARZAN-${user.id.slice(-4).toUpperCase()}`;

    // Get cashback percentage setting
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'ORDER_CASHBACK_PERCENT' },
    });
    const cashbackPercent = setting?.value ? parseInt(setting.value, 10) : 10;

    // Potential referral codes used by inviter
    const candidates = [referralCode, user.id, `ARZAN-${user.id.slice(-4).toUpperCase()}`];
    if (user.referralCode) {
      candidates.push(user.referralCode.toUpperCase());
      candidates.push(user.referralCode.toLowerCase());
    }

    const uniqueCandidates = Array.from(new Set(candidates));

    const referredUsers = await this.prisma.user.findMany({
      where: {
        referredByCode: {
          in: uniqueCandidates,
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const referralsList: any[] = [];
    let totalOrdersCount = 0;
    let totalSpentByReferrals = 0;

    // Batch fetch all completed/delivered orders for all referred users in a single O(1) query
    const phones = referredUsers.map((u) => u.phone?.trim()).filter(Boolean) as string[];
    const emails = referredUsers.map((u) => u.email?.trim().toLowerCase()).filter(Boolean) as string[];

    const searchConditions: any[] = [];
    if (phones.length > 0) searchConditions.push({ customerPhone: { in: phones } });
    if (emails.length > 0) searchConditions.push({ customerEmail: { in: emails } });

    let allCompletedOrders: any[] = [];
    if (searchConditions.length > 0) {
      allCompletedOrders = await this.prisma.order.findMany({
        where: {
          OR: searchConditions,
          status: { in: ['completed', 'delivered'] },
        },
        select: {
          id: true,
          customerPhone: true,
          customerEmail: true,
          totalPriceToman: true,
          createdAt: true,
        },
      });
    }

    for (const refUser of referredUsers) {
      const userPhone = refUser.phone?.trim();
      const userEmail = refUser.email?.trim().toLowerCase();

      const orders = allCompletedOrders.filter((o) => {
        return (userPhone && o.customerPhone === userPhone) || (userEmail && o.customerEmail?.toLowerCase() === userEmail);
      });

      const ordersCount = orders.length;
      const totalSpentToman = orders.reduce((sum, o) => sum + (o.totalPriceToman || 0), 0);
      const earnedFromUserToman = Math.round(totalSpentToman * (cashbackPercent / 100));

      totalOrdersCount += ordersCount;
      totalSpentByReferrals += totalSpentToman;

      let phoneMasked = 'بدون شماره';
      if (refUser.phone) {
        const p = refUser.phone.trim();
        if (p.length >= 8) {
          phoneMasked = `${p.slice(0, 4)}***${p.slice(-4)}`;
        } else {
          phoneMasked = p;
        }
      }

      let emailMasked = 'بدون ایمیل';
      if (refUser.email) {
        const parts = refUser.email.split('@');
        if (parts[0].length > 2) {
          emailMasked = `${parts[0].slice(0, 2)}***@${parts[1] || ''}`;
        } else {
          emailMasked = refUser.email;
        }
      }

      referralsList.push({
        id: refUser.id,
        name: refUser.name || 'کاربر ارزون‌حساب',
        phoneMasked,
        emailMasked,
        joinedAt: refUser.createdAt,
        ordersCount,
        totalSpentToman,
        earnedFromUserToman,
      });
    }

    const activeBuyers = referralsList.filter((r) => r.ordersCount > 0).length;
    const calculatedEarned = Math.round(totalSpentByReferrals * (cashbackPercent / 100));
    const totalEarnedToman = calculatedEarned;

    return {
      referralCode,
      cashbackPercent,
      stats: {
        totalReferred: referralsList.length,
        activeBuyers,
        totalOrdersCount,
        totalEarnedToman,
        totalSpentByReferrals,
      },
      referrals: referralsList,
    };
  }
}
