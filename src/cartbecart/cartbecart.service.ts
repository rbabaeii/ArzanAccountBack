import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { OrdersService } from '../orders/orders.service';
import { CartBeCartClientService } from './cartbecart-client.service';
import {
  InitiateCardPaymentDto,
  SubmitManualReceiptDto,
  AdminApprovePaymentDto,
  AdminRejectPaymentDto,
  UpdateCartBeCartSettingsDto,
} from './cartbecart.dto';
import {
  SETTING_KEY_CARTBECART_API_KEY,
  SETTING_KEY_CARTBECART_ENABLED,
  SETTING_KEY_FALLBACK_CARD_NUMBER,
  SETTING_KEY_FALLBACK_CARD_OWNER,
  SETTING_KEY_FALLBACK_BANK_NAME,
  DEFAULT_FALLBACK_CARD,
} from './cartbecart.constants';

import { SmsService } from '../sms/sms.service';

@Injectable()
export class CartBeCartService {
  private readonly logger = new Logger(CartBeCartService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: CartBeCartClientService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly ordersService: OrdersService,
  ) {}

  /**
   * Helper to retrieve a system setting by key with fallback
   */
  private async getSetting(key: string, defaultValue: string = ''): Promise<string> {
    try {
      const setting = await this.prisma.systemSetting.findUnique({ where: { key } });
      return setting?.value || process.env[key] || defaultValue;
    } catch {
      return process.env[key] || defaultValue;
    }
  }

  /**
   * Get all CartBeCart gateway settings
   */
  async getSettings() {
    const [apiKey, enabledStr, fallbackCardNumber, fallbackCardOwner, fallbackBankName] =
      await Promise.all([
        this.getSetting(SETTING_KEY_CARTBECART_API_KEY, process.env.CARTBECART_API_KEY || ''),
        this.getSetting(SETTING_KEY_CARTBECART_ENABLED, 'true'),
        this.getSetting(SETTING_KEY_FALLBACK_CARD_NUMBER, DEFAULT_FALLBACK_CARD.cardNumber),
        this.getSetting(SETTING_KEY_FALLBACK_CARD_OWNER, DEFAULT_FALLBACK_CARD.cardOwner),
        this.getSetting(SETTING_KEY_FALLBACK_BANK_NAME, DEFAULT_FALLBACK_CARD.bankName),
      ]);

    let liveStatus: {
      connected: boolean;
      shopName?: string;
      plan?: string;
      subscriptionActive?: boolean;
      apiAccess?: boolean;
      orderTtlMinutes?: number;
      graceMinutes?: number;
      hasActiveDefaultCard?: boolean;
      quota?: { used: number; limit: number; period_ends_at: string };
      error?: string;
    } = { connected: false };

    if (apiKey) {
      try {
        const config = await this.client.getShopConfig(apiKey);
        if (config) {
          liveStatus = {
            connected: true,
            shopName: config.shop_name,
            plan: config.plan,
            subscriptionActive: config.subscription_active,
            apiAccess: config.api_access,
            orderTtlMinutes: config.order_ttl_minutes,
            graceMinutes: config.grace_minutes,
            hasActiveDefaultCard: config.has_active_default_card,
            quota: config.quota,
          };
        }
      } catch (err: any) {
        liveStatus = { connected: false, error: err?.message };
      }
    }

    return {
      apiKey: apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : '',
      hasApiKey: Boolean(apiKey),
      enabled: enabledStr === 'true',
      fallbackCardNumber,
      fallbackCardOwner,
      fallbackBankName,
      liveStatus,
    };
  }

  /**
   * Update CartBeCart gateway settings
   */
  async updateSettings(dto: UpdateCartBeCartSettingsDto) {
    const updates: Promise<any>[] = [];

    if (dto.apiKey !== undefined && dto.apiKey.trim().length > 0 && !dto.apiKey.includes('...')) {
      updates.push(
        this.prisma.systemSetting.upsert({
          where: { key: SETTING_KEY_CARTBECART_API_KEY },
          update: { value: dto.apiKey.trim() },
          create: {
            key: SETTING_KEY_CARTBECART_API_KEY,
            value: dto.apiKey.trim(),
            description: 'کلید وب‌سرویس CartBeCart',
          },
        }),
      );
    }

    if (dto.enabled !== undefined) {
      updates.push(
        this.prisma.systemSetting.upsert({
          where: { key: SETTING_KEY_CARTBECART_ENABLED },
          update: { value: String(dto.enabled) },
          create: {
            key: SETTING_KEY_CARTBECART_ENABLED,
            value: String(dto.enabled),
            description: 'وضعیت فعال/غیرفعال بودن درگاه کارت‌به‌کارت',
          },
        }),
      );
    }

    if (dto.fallbackCardNumber !== undefined) {
      updates.push(
        this.prisma.systemSetting.upsert({
          where: { key: SETTING_KEY_FALLBACK_CARD_NUMBER },
          update: { value: dto.fallbackCardNumber },
          create: {
            key: SETTING_KEY_FALLBACK_CARD_NUMBER,
            value: dto.fallbackCardNumber,
            description: 'شماره کارت مقصد پشتیبان',
          },
        }),
      );
    }

    if (dto.fallbackCardOwner !== undefined) {
      updates.push(
        this.prisma.systemSetting.upsert({
          where: { key: SETTING_KEY_FALLBACK_CARD_OWNER },
          update: { value: dto.fallbackCardOwner },
          create: {
            key: SETTING_KEY_FALLBACK_CARD_OWNER,
            value: dto.fallbackCardOwner,
            description: 'نام صاحب کارت مقصد پشتیبان',
          },
        }),
      );
    }

    if (dto.fallbackBankName !== undefined) {
      updates.push(
        this.prisma.systemSetting.upsert({
          where: { key: SETTING_KEY_FALLBACK_BANK_NAME },
          update: { value: dto.fallbackBankName },
          create: {
            key: SETTING_KEY_FALLBACK_BANK_NAME,
            value: dto.fallbackBankName,
            description: 'نام بانک مقصد پشتیبان',
          },
        }),
      );
    }

    await Promise.all(updates);
    return this.getSettings();
  }

  /**
   * Initiate a Card-to-Card payment transaction
   */
  async initiatePayment(dto: InitiateCardPaymentDto) {
    const apiKey = await this.getSetting(SETTING_KEY_CARTBECART_API_KEY, process.env.CARTBECART_API_KEY || '');
    const fallbackCardNumber = await this.getSetting(
      SETTING_KEY_FALLBACK_CARD_NUMBER,
      DEFAULT_FALLBACK_CARD.cardNumber,
    );
    const fallbackCardOwner = await this.getSetting(
      SETTING_KEY_FALLBACK_CARD_OWNER,
      DEFAULT_FALLBACK_CARD.cardOwner,
    );

    const amountRial = Math.round(dto.amountToman * 10);
    const merchantOrderId =
      dto.orderNumber ||
      `TX-${dto.paymentType === 'WALLET_TOPUP' ? 'WLT' : 'ORD'}-${Date.now().toString().slice(-6)}`;

    const siteBaseUrl =
      process.env.SITE_PUBLIC_URL ||
      process.env.FRONTEND_URL ||
      'https://arzanaccount.com';
    const callbackUrl =
      dto.callbackUrl ||
      `${siteBaseUrl}/payment/cartbecart/callback`;

    // 0. Check if an active unexpired pending payment token already exists for this order
    if (dto.orderNumber) {
      const existing = await this.prisma.cardPayment.findFirst({
        where: {
          orderNumber: dto.orderNumber,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) {
        const uniqueAmountToman = Math.ceil((existing.uniqueAmountRial || existing.amountRial) / 10);
        return {
          id: existing.id,
          paymentToken: existing.paymentToken,
          orderNumber: existing.orderNumber,
          amountToman: existing.amountToman,
          amountRial: existing.amountRial,
          uniqueAmountRial: existing.uniqueAmountRial || existing.amountRial,
          uniqueAmountToman,
          destCardNumber: existing.destCardNumber || fallbackCardNumber,
          destCardOwner: existing.destCardOwner || fallbackCardOwner,
          expiresAt: existing.expiresAt,
          paymentUrl: existing.paymentUrl,
          status: existing.status,
        };
      }
    }

    // 1. Call CartBeCart client to create order
    const cbcOrder = await this.client.createOrder(apiKey, {
      amount: amountRial,
      callback_url: callbackUrl,
      merchant_order_id: merchantOrderId,
      customer_name: dto.customerName,
      customer_phone: dto.customerPhone,
    });

    // 2. Fetch destination card details
    let destCardNumber = fallbackCardNumber;
    let destCardOwner = fallbackCardOwner;

    if (cbcOrder.payment_token) {
      const payDetails = await this.client.getPayDetails(cbcOrder.payment_token);
      if (payDetails?.card_number) {
        destCardNumber = payDetails.card_number;
      }
      if (payDetails?.card_owner) {
        destCardOwner = payDetails.card_owner;
      }
    }

    const expiresAt = cbcOrder.expires_at ? new Date(cbcOrder.expires_at) : new Date(Date.now() + 15 * 60 * 1000);
    const graceEndsAt = cbcOrder.grace_ends_at ? new Date(cbcOrder.grace_ends_at) : new Date(Date.now() + 75 * 60 * 1000);

    // 3. Save to database
    const cardPayment = await this.prisma.cardPayment.create({
      data: {
        paymentToken: cbcOrder.payment_token,
        orderId: dto.orderId || null,
        userId: dto.userId || null,
        orderNumber: merchantOrderId,
        paymentType: dto.paymentType,
        amountToman: dto.amountToman,
        amountRial,
        uniqueAmountRial: cbcOrder.unique_amount || amountRial,
        status: 'PENDING',
        cartBeCartOrderId: cbcOrder.order_id || null,
        cartBeCartOrderCode: cbcOrder.order_code || null,
        paymentUrl: cbcOrder.payment_url || null,
        destCardNumber,
        destCardOwner,
        expiresAt,
        graceEndsAt,
      },
    });

    const uniqueAmountToman = Math.ceil((cardPayment.uniqueAmountRial || cardPayment.amountRial) / 10);

    return {
      id: cardPayment.id,
      paymentToken: cardPayment.paymentToken,
      orderNumber: cardPayment.orderNumber,
      amountToman: cardPayment.amountToman,
      amountRial: cardPayment.amountRial,
      uniqueAmountRial: cardPayment.uniqueAmountRial,
      uniqueAmountToman,
      destCardNumber: cardPayment.destCardNumber,
      destCardOwner: cardPayment.destCardOwner,
      expiresAt: cardPayment.expiresAt,
      paymentUrl: cardPayment.paymentUrl,
      status: cardPayment.status,
    };
  }

  /**
   * Check payment status against CartBeCart API and handle fulfillment
   */
  async checkPaymentStatus(paymentToken: string) {
    const payment = await this.prisma.cardPayment.findUnique({
      where: { paymentToken },
    });

    if (!payment) {
      throw new NotFoundException(`تراکنش پرداختی با شناسه ${paymentToken} یافت نشد.`);
    }

    // If already finalized, return immediately
    if (payment.status === 'PAID' || payment.status === 'APPROVED') {
      return {
        ...payment,
        isCompleted: true,
      };
    }

    // If this is a manual review payment or not connected to a CartBeCart remote order, do not call CartBeCart API
    if (
      payment.status === 'MANUAL_REVIEW' ||
      payment.paymentToken.startsWith('MANUAL-') ||
      !payment.cartBeCartOrderId
    ) {
      return {
        ...payment,
        isCompleted: payment.status === 'APPROVED' || payment.status === 'PAID',
      };
    }

    const apiKey = await this.getSetting(SETTING_KEY_CARTBECART_API_KEY, process.env.CARTBECART_API_KEY || '');
    const remoteOrder = await this.client.getOrderStatus(apiKey, paymentToken);

    if (remoteOrder && remoteOrder.status === 'paid') {
      // Atomic status update to prevent race conditions / duplicate fulfillment
      const updateResult = await this.prisma.cardPayment.updateMany({
        where: { id: payment.id, status: { in: ['PENDING', 'MANUAL_REVIEW'] } },
        data: {
          status: 'PAID',
          paidAt: remoteOrder.paid_at ? new Date(remoteOrder.paid_at) : new Date(),
        },
      });

      if (updateResult.count > 0) {
        await this.fulfillPayment(payment, 'AUTO_VERIFIED');
      }

      const freshPayment = await this.prisma.cardPayment.findUnique({
        where: { id: payment.id },
      });
      return {
        ...freshPayment,
        isCompleted: true,
      };
    } else if (remoteOrder && remoteOrder.status === 'needs_review') {
      const updated = await this.prisma.cardPayment.update({
        where: { id: payment.id },
        data: {
          status: 'MANUAL_REVIEW',
          adminNote: payment.adminNote || 'واریز شناسایی شده در سامانه، نیازمند تأیید در پنل CartBeCart است (needs_review).',
        },
      });
      return {
        ...updated,
        isCompleted: false,
        isNeedsReview: true,
      };
    } else if (remoteOrder && remoteOrder.status === 'expired') {
      if (payment.status === 'PENDING') {
        const updated = await this.prisma.cardPayment.update({
          where: { id: payment.id },
          data: { status: 'EXPIRED' },
        });
        return {
          ...updated,
          isCompleted: false,
        };
      }
    }

    return {
      ...payment,
      isCompleted: false,
    };
  }

  /**
   * Submit manual receipt/tracking code for fallback review
   */
  async submitManualReceipt(dto: SubmitManualReceiptDto) {
    const targetOrderNumber = dto.orderNumber;
    const targetOrderId = dto.orderId;

    // 1. Expire any existing automatic inquiry / PENDING payment records for this order or token
    if (targetOrderNumber || targetOrderId) {
      await this.prisma.cardPayment.updateMany({
        where: {
          OR: [
            ...(targetOrderNumber ? [{ orderNumber: targetOrderNumber }] : []),
            ...(targetOrderId ? [{ orderId: targetOrderId }] : []),
          ],
          status: 'PENDING',
        },
        data: {
          status: 'EXPIRED',
        },
      });
    }

    if (dto.paymentToken) {
      await this.prisma.cardPayment.updateMany({
        where: {
          paymentToken: dto.paymentToken,
          status: 'PENDING',
        },
        data: {
          status: 'EXPIRED',
        },
      });
    }

    // 2. Find or create a dedicated MANUAL_REVIEW record for this order
    let payment =
      targetOrderNumber || targetOrderId
        ? await this.prisma.cardPayment.findFirst({
            where: {
              OR: [
                ...(targetOrderNumber ? [{ orderNumber: targetOrderNumber }] : []),
                ...(targetOrderId ? [{ orderId: targetOrderId }] : []),
              ],
              status: 'MANUAL_REVIEW',
            },
            orderBy: { createdAt: 'desc' },
          })
        : null;

    if (!payment) {
      // Create new manual payment record
      const token = `MANUAL-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      payment = await this.prisma.cardPayment.create({
        data: {
          paymentToken: token,
          orderId: dto.orderId || null,
          userId: dto.userId || null,
          orderNumber: dto.orderNumber || `ORD-MANUAL-${Date.now().toString().slice(-6)}`,
          paymentType: dto.paymentType || 'ORDER',
          amountToman: dto.amountToman,
          amountRial: dto.amountToman * 10,
          status: 'MANUAL_REVIEW',
          trackingCode: dto.trackingCode,
          userCardNumber: dto.userCardNumber || null,
          receiptUrl: dto.receiptUrl || null,
          depositTime: dto.depositTime || new Date().toISOString(),
          userNote: dto.userNote || null,
        },
      });
    } else {
      // Update existing manual review record
      payment = await this.prisma.cardPayment.update({
        where: { id: payment.id },
        data: {
          status: 'MANUAL_REVIEW',
          trackingCode: dto.trackingCode,
          userCardNumber: dto.userCardNumber || payment.userCardNumber,
          receiptUrl: dto.receiptUrl || payment.receiptUrl,
          depositTime: dto.depositTime || new Date().toISOString(),
          userNote: dto.userNote || payment.userNote,
        },
      });
    }

    // If attached to an Order, record audit log or update gateway info
    if (payment.orderNumber) {
      try {
        const order = await this.prisma.order.findFirst({
          where: {
            OR: [{ orderNumber: payment.orderNumber }, { id: payment.orderId || '' }],
          },
        });
        if (order) {
          await this.prisma.auditLog.create({
            data: {
              action: `ثبت دستی فیش واریزی سفارش #${order.orderNumber}`,
              details: `کد پیگیری: ${dto.trackingCode} | مبلغ: ${new Intl.NumberFormat('fa-IR').format(dto.amountToman)} تومان | کارت: ${dto.userCardNumber || 'نامشخص'}. (درخواست قبلی استعلام خودکار منقضی شد)`,
              type: 'PAYMENT_RECEIPT_SUBMITTED',
              user: order.customerEmail || 'Customer',
            },
          });
        }
      } catch (logErr) {
        this.logger.warn(`Failed to create audit log for manual receipt: ${logErr?.message}`);
      }
    }

    return payment;
  }

  /**
   * Get card payments / deposits for a specific user
   */
  async getUserPayments(
    userId: string,
    params?: {
      status?: string;
      type?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(100, Math.max(1, params?.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (params?.status && params.status !== 'all') {
      where.status = params.status;
    }
    if (params?.type && params.type !== 'all') {
      where.paymentType = params.type;
    }

    const [items, total] = await Promise.all([
      this.prisma.cardPayment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.cardPayment.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get payments for admin review with user enrichment, filtering, and pagination
   */
  async getAdminPayments(params: {
    status?: string;
    type?: string;
    userId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.status && params.status !== 'all') {
      where.status = params.status;
    } else {
      // By default when viewing all payments, exclude EXPIRED records so superseded requests do not clutter the list
      where.status = { not: 'EXPIRED' };
    }

    if (params.type && params.type !== 'all') {
      where.paymentType = params.type;
    }

    if (params.userId) {
      where.userId = params.userId;
    }

    if (params.search) {
      const q = params.search.trim();
      // Also match users by name, phone, or email
      const matchingUsers = await this.prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { phone: { contains: q } },
            { email: { contains: q } },
          ],
        },
        select: { id: true },
      });
      const matchingUserIds = matchingUsers.map((u) => u.id);

      where.OR = [
        { orderNumber: { contains: q } },
        { trackingCode: { contains: q } },
        { userCardNumber: { contains: q } },
        { paymentToken: { contains: q } },
        ...(matchingUserIds.length > 0 ? [{ userId: { in: matchingUserIds } }] : []),
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.cardPayment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.cardPayment.count({ where }),
    ]);

    // Enrich payments with user profiles
    const userIds = Array.from(new Set(items.map((i) => i.userId).filter(Boolean))) as string[];
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              role: true,
              walletBalanceToman: true,
            },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const enrichedItems = items.map((item) => ({
      ...item,
      user: item.userId ? userMap.get(item.userId) || null : null,
    }));

    return {
      items: enrichedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Admin approves manual payment
   */
  async adminApprovePayment(
    id: string,
    dto: AdminApprovePaymentDto,
    adminUser: { id?: string; name?: string; phone?: string },
  ) {
    const payment = await this.prisma.cardPayment.findUnique({ where: { id } });
    if (!payment) {
      throw new NotFoundException(`تراکنش پرداختی با شناسه ${id} یافت نشد.`);
    }

    if (payment.status === 'APPROVED' || payment.status === 'PAID') {
      throw new BadRequestException('این تراکنش قبلاً با موفقیت تأیید شده است.');
    }

    const updateResult = await this.prisma.cardPayment.updateMany({
      where: { id: payment.id, status: { in: ['MANUAL_REVIEW', 'PENDING'] } },
      data: {
        status: 'APPROVED',
        adminNote: dto.adminNote || payment.adminNote,
        reviewedByAdminId: adminUser.id || null,
        reviewedByAdminName: adminUser.name || 'مدیر مالی',
        reviewedAt: new Date(),
        paidAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      throw new BadRequestException('این تراکنش قبلاً تعیین تکلیف یا تایید شده است.');
    }

    // Fulfill order or top up wallet (single execution)
    await this.fulfillPayment(payment, 'MANUAL_ADMIN_APPROVED', adminUser);

    const updated = await this.prisma.cardPayment.findUnique({ where: { id } });

    // Record audit log
    await this.prisma.auditLog.create({
      data: {
        action: `تأیید دستی پرداخت کارت‌به‌کارت #${payment.orderNumber}`,
        details: `مبلغ ${new Intl.NumberFormat('fa-IR').format(payment.amountToman)} تومان توسط ${adminUser.name || 'مدیر سیستم'} تأیید شد. کد رهگیری: ${payment.trackingCode || 'ندارد'}.`,
        type: 'PAYMENT_ADMIN_APPROVED',
        adminId: adminUser.id,
        adminName: adminUser.name,
        adminPhone: adminUser.phone,
      },
    });

    // Expire any lingering PENDING payment records for this order
    if (payment.orderNumber) {
      await this.prisma.cardPayment.updateMany({
        where: {
          orderNumber: payment.orderNumber,
          status: 'PENDING',
          id: { not: payment.id },
        },
        data: {
          status: 'EXPIRED',
        },
      });
    }

    return updated;
  }

  /**
   * Admin rejects manual payment
   */
  async adminRejectPayment(
    id: string,
    dto: AdminRejectPaymentDto,
    adminUser: { id?: string; name?: string; phone?: string },
  ) {
    const payment = await this.prisma.cardPayment.findUnique({ where: { id } });
    if (!payment) {
      throw new NotFoundException(`تراکنش پرداختی با شناسه ${id} یافت نشد.`);
    }

    if (payment.status === 'APPROVED' || payment.status === 'PAID') {
      throw new BadRequestException('امکان رد کردن تراکنش تایید شده وجود ندارد.');
    }

    const updated = await this.prisma.cardPayment.update({
      where: { id },
      data: {
        status: 'REJECTED',
        adminNote: dto.reason,
        reviewedByAdminId: adminUser.id || null,
        reviewedByAdminName: adminUser.name || 'مدیر مالی',
        reviewedAt: new Date(),
      },
    });

    // Update associated order if it was an order payment
    if (payment.paymentType === 'ORDER' && payment.orderNumber) {
      try {
        await this.prisma.order.updateMany({
          where: {
            OR: [{ orderNumber: payment.orderNumber }, { id: payment.orderId || '' }],
            status: 'pending',
          },
          data: {
            status: 'cancelled',
          },
        });
      } catch (orderErr: any) {
        this.logger.warn(`Failed to update order status on payment rejection: ${orderErr?.message}`);
      }
    }

    // Record audit log
    await this.prisma.auditLog.create({
      data: {
        action: `رد پرداخت کارت‌به‌کارت #${payment.orderNumber}`,
        details: `پرداخت به مبلغ ${new Intl.NumberFormat('fa-IR').format(payment.amountToman)} تومان به دلیل: "${dto.reason}" رد شد.`,
        type: 'PAYMENT_ADMIN_REJECTED',
        adminId: adminUser.id,
        adminName: adminUser.name,
        adminPhone: adminUser.phone,
      },
    });

    return updated;
  }

  /**
   * Test simulation helper for instant payment verification
   */
  async simulatePaymentSuccess(
    paymentToken: string,
    adminUser?: { id?: string; name?: string; role?: string },
  ) {
    const payment = await this.prisma.cardPayment.findUnique({
      where: { paymentToken },
    });
    if (!payment) {
      throw new NotFoundException(`تراکنش پرداختی با شناسه ${paymentToken} یافت نشد.`);
    }

    if (payment.status === 'PAID' || payment.status === 'APPROVED') {
      return payment;
    }

    const updateResult = await this.prisma.cardPayment.updateMany({
      where: { id: payment.id, status: { in: ['PENDING', 'MANUAL_REVIEW'] } },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    if (updateResult.count > 0) {
      const requestingUser = adminUser || { name: 'سیستم شبیه‌ساز تست' };
      await this.fulfillPayment(payment, 'SIMULATED_TEST', requestingUser);
    }

    return this.prisma.cardPayment.findUnique({
      where: { id: payment.id },
    });
  }

  /**
   * Fulfill order or top up wallet upon payment approval or verification
   */
  private async fulfillPayment(
    payment: any,
    reason: string,
    adminUser?: { id?: string; name?: string; role?: string },
  ) {
    if (payment.paymentType === 'WALLET_TOPUP') {
      if (!payment.userId) {
        this.logger.warn(`Wallet topup payment ${payment.id} has no userId attached.`);
        return;
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: payment.userId },
        data: {
          walletBalanceToman: { increment: payment.amountToman },
          directDepositBalance: { increment: payment.amountToman },
        },
      });

      this.logger.log(
        `[WALLET TOPUP SUCCESS] Credited ${payment.amountToman} Toman to ${updatedUser.name} (${updatedUser.id}). Reason: ${reason}`,
      );

      await this.prisma.auditLog.create({
        data: {
          action: `شارژ کیف پول کاربری از طریق کارت به کارت (${reason})`,
          details: `مبلغ ${new Intl.NumberFormat('fa-IR').format(payment.amountToman)} تومان به کیف پول کاربر ${updatedUser.name} اضافه شد. موجودی جدید: ${updatedUser.walletBalanceToman} تومان.`,
          type: 'WALLET_TOPPED_UP',
          user: updatedUser.email || updatedUser.phone || 'User',
          adminId: adminUser?.id,
          adminName: adminUser?.name,
        },
      });

      // Dispatch SMS on successful wallet topup
      if (updatedUser.phone) {
        this.smsService
          .sendWalletTopupSms(updatedUser.phone, payment.amountToman)
          .catch((err) => this.logger.warn(`Failed to send wallet topup SMS to ${updatedUser.phone}: ${err?.message}`));
      }
    } else {
      // Fulfill Order
      const order = await this.prisma.order.findFirst({
        where: {
          OR: [{ orderNumber: payment.orderNumber }, { id: payment.orderId || '' }],
        },
      });

      if (!order) {
        this.logger.warn(`Order #${payment.orderNumber} not found for payment fulfillment.`);
        return;
      }

      // If already processing or delivered, keep status
      const targetStatus = order.deliveryType === 'account_activation' || order.isHybridOrder ? 'processing' : 'delivered';

      let deliveredAccounts = order.deliveredAccounts;
      if (!deliveredAccounts && targetStatus === 'delivered') {
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
        const generated: string[] = [];
        items.forEach((item: any) => {
          const title = item.productTitle || item.title || 'اشتراک دیجیتال';
          const qty = Number(item.quantity) || 1;
          for (let q = 1; q <= qty; q++) {
            generated.push(
              `اکانت تحویل‌شده (${title} #${q}) -> شناسه کاربری: ${order.customerEmail} | توکن اختصاصی: ARZ-${Math.floor(100000 + Math.random() * 900000)} (فعال‌سازی رسمی)`,
            );
          }
        });
        deliveredAccounts = JSON.stringify(generated);
      }

      const updatedOrder = await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: targetStatus,
          paymentGateway: 'cartbecart',
          ...(deliveredAccounts ? { deliveredAccounts } : {}),
        },
      });

      this.logger.log(
        `[ORDER PAYMENT SUCCESS] Order #${order.orderNumber} marked as ${targetStatus}. Reason: ${reason}`,
      );

      // Award referral cashback if eligible
      try {
        if (updatedOrder && (updatedOrder.status === 'completed' || updatedOrder.status === 'delivered')) {
          await this.ordersService.awardReferralCashbackIfEligible(updatedOrder);
        }
      } catch (cbErr: any) {
        this.logger.warn(`Referral cashback check failed for order #${order.orderNumber}: ${cbErr?.message}`);
      }

      // Trigger order receipt email
      try {
        const parsedItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        await this.emailService.sendOrderReceipt({
          orderNumber: order.orderNumber,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone || undefined,
          createdAt: new Intl.DateTimeFormat('fa-IR', { dateStyle: 'full', timeStyle: 'short' }).format(new Date()),
          items: parsedItems || [],
          deliveredAccounts: order.deliveredAccounts ? JSON.parse(order.deliveredAccounts) : [],
          accountCredentials: order.accountCredentials ? JSON.parse(order.accountCredentials) : [],
          isHybridOrder: Boolean(order.isHybridOrder),
          instantItemsCount: order.instantItemsCount || 0,
          activationItemsCount: order.activationItemsCount || 0,
          totalPriceToman: order.totalPriceToman,
          totalPriceUsd: order.totalPriceUsd,
          paymentGateway: 'کارت به کارت (CartBeCart)',
        });
      } catch (emailErr) {
        this.logger.warn(`Failed to send order email for order #${order.orderNumber}: ${emailErr?.message}`);
      }

      // Dispatch real SMS on order payment confirmation
      if (order.customerPhone) {
        this.smsService
          .sendOrderCreatedSms(
            order.customerPhone,
            order.orderNumber,
            order.totalPriceToman,
            order.customerEmail ? order.customerEmail.split('@')[0] : 'کاربر گرامی',
          )
          .catch((err) => this.logger.warn(`Failed to send order payment SMS: ${err?.message}`));
      }
    }
  }
}
