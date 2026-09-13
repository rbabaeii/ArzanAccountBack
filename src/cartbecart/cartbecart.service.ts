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

@Injectable()
export class CartBeCartService {
  private readonly logger = new Logger(CartBeCartService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: CartBeCartClientService,
    private readonly emailService: EmailService,
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

    return {
      apiKey: apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : '',
      hasApiKey: Boolean(apiKey),
      enabled: enabledStr === 'true',
      fallbackCardNumber,
      fallbackCardOwner,
      fallbackBankName,
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

    if (cbcOrder.payment_token && !cbcOrder.payment_token.startsWith('SIM-')) {
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

    const apiKey = await this.getSetting(SETTING_KEY_CARTBECART_API_KEY, process.env.CARTBECART_API_KEY || '');
    const remoteOrder = await this.client.getOrderStatus(apiKey, paymentToken);

    if (remoteOrder && remoteOrder.status === 'paid') {
      // Payment verified automatically!
      await this.fulfillPayment(payment, 'AUTO_VERIFIED');
      const updated = await this.prisma.cardPayment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          paidAt: remoteOrder.paid_at ? new Date(remoteOrder.paid_at) : new Date(),
        },
      });
      return {
        ...updated,
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
    let payment = dto.paymentToken
      ? await this.prisma.cardPayment.findUnique({
          where: { paymentToken: dto.paymentToken },
        })
      : null;

    if (!payment) {
      // Create new manual payment record if initiated directly
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
      // Update existing payment record to manual review
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
              details: `کد پیگیری: ${dto.trackingCode} | مبلغ: ${new Intl.NumberFormat('fa-IR').format(dto.amountToman)} تومان | کارت: ${dto.userCardNumber || 'نامشخص'}`,
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
   * Get payments for admin review with filtering and pagination
   */
  async getAdminPayments(params: {
    status?: string;
    type?: string;
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
    }
    if (params.type && params.type !== 'all') {
      where.paymentType = params.type;
    }
    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { orderNumber: { contains: q } },
        { trackingCode: { contains: q } },
        { userCardNumber: { contains: q } },
        { paymentToken: { contains: q } },
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

    return {
      items,
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

    // Fulfill order or top up wallet
    await this.fulfillPayment(payment, 'MANUAL_ADMIN_APPROVED', adminUser);

    const updated = await this.prisma.cardPayment.update({
      where: { id },
      data: {
        status: 'APPROVED',
        adminNote: dto.adminNote || payment.adminNote,
        reviewedByAdminId: adminUser.id || null,
        reviewedByAdminName: adminUser.name || 'مدیر مالی',
        reviewedAt: new Date(),
        paidAt: new Date(),
      },
    });

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
        details: `علت رد: ${dto.reason} | بررسی‌کننده: ${adminUser.name || 'مدیر مالی'}`,
        type: 'PAYMENT_ADMIN_REJECTED',
        adminId: adminUser.id,
        adminName: adminUser.name,
        adminPhone: adminUser.phone,
      },
    });

    return updated;
  }

  /**
   * Simulation method: triggers instant payment confirmation for testing without real banking API
   * Strictly guards against unauthorized usage in production environments
   */
  async simulatePaymentSuccess(
    paymentToken: string,
    requestingUser?: { role?: string; id?: string },
  ) {
    const isProd = process.env.NODE_ENV === 'production';
    const isAdmin =
      requestingUser?.role === 'SUPER_ADMIN' ||
      requestingUser?.role === 'ADMIN' ||
      requestingUser?.role === 'FINANCE_ADMIN';

    if (isProd && !isAdmin) {
      throw new ForbiddenException('شبیه‌سازی پرداخت تنها در محیط توسعه یا توسط مدیر سیستم مجاز است.');
    }

    const payment = await this.prisma.cardPayment.findUnique({
      where: { paymentToken },
    });
    if (!payment) throw new NotFoundException('تراکنش یافت نشد.');

    await this.fulfillPayment(payment, 'SIMULATED_TEST', requestingUser);

    return this.prisma.cardPayment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
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

      const user = await this.prisma.user.findUnique({ where: { id: payment.userId } });
      if (!user) {
        this.logger.error(`User ${payment.userId} not found to topup wallet.`);
        return;
      }

      const newDirect = (user.directDepositBalance || 0) + payment.amountToman;
      const currentBonus = user.cashbackBonusBalance || 0;
      const newTotal = newDirect + currentBonus;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          walletBalanceToman: newTotal,
          directDepositBalance: newDirect,
        },
      });

      this.logger.log(
        `[WALLET TOPUP SUCCESS] Credited ${payment.amountToman} Toman to ${user.name} (${user.id}). Reason: ${reason}`,
      );

      await this.prisma.auditLog.create({
        data: {
          action: `شارژ کیف پول کاربری از طریق کارت به کارت (${reason})`,
          details: `مبلغ ${new Intl.NumberFormat('fa-IR').format(payment.amountToman)} تومان به کیف پول کاربر ${user.name} اضافه شد. موجودی جدید: ${newTotal} تومان.`,
          type: 'WALLET_TOPPED_UP',
          user: user.email || user.phone || 'User',
          adminId: adminUser?.id,
          adminName: adminUser?.name,
        },
      });
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

      const updatedOrder = await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: targetStatus,
          paymentGateway: 'cartbecart',
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
    }
  }
}
