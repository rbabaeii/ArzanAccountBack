import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';
import { CatalogService } from '../catalog/catalog.service';
import { PricingService } from '../pricing/pricing.service';
import { CouponsService } from '../coupons/coupons.service';
import { CreateOrderDto, UpdateOrderStatusDto, ProcessRefundDto, RequestRefundDto, RejectRefundDto } from './orders.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly catalogService: CatalogService,
    private readonly pricingService: PricingService,
    private readonly couponsService: CouponsService,
  ) {}

  async getOrders(params?: { status?: string; customerEmail?: string; customerPhone?: string; limit?: number; offset?: number }) {
    const where: any = {};
    if (params?.status) where.status = params.status;
    if (params?.customerEmail && params?.customerPhone) {
      where.OR = [
        { customerEmail: params.customerEmail },
        { customerPhone: params.customerPhone },
      ];
    } else if (params?.customerEmail) {
      where.customerEmail = params.customerEmail;
    } else if (params?.customerPhone) {
      where.customerPhone = params.customerPhone;
    }

    const [orders, totalCount] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params?.limit ? Number(params.limit) : 50,
        skip: params?.offset ? Number(params.offset) : 0,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders: orders.map(o => ({
        ...o,
        items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items,
        deliveredAccounts: o.deliveredAccounts ? JSON.parse(o.deliveredAccounts) : [],
        accountCredentials: o.accountCredentials ? JSON.parse(o.accountCredentials) : [],
      })),
      totalCount,
    };
  }

  async getOrderById(id: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id }],
      },
    });

    if (!order) throw new NotFoundException(`سفارش ${id} یافت نشد.`);

    return {
      ...order,
      items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
      deliveredAccounts: order.deliveredAccounts ? JSON.parse(order.deliveredAccounts) : [],
      accountCredentials: order.accountCredentials ? JSON.parse(order.accountCredentials) : [],
    };
  }

  async getUserContact(userId: string) {
    if (!userId) return null;
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true },
    });
  }

  async createOrder(dto: CreateOrderDto, authenticatedUser?: any) {
    if (!dto.items || !Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('سبد خرید خالی است یا آیتمی ارسال نشده است.');
    }

    let calculatedSubtotalToman = 0;
    let calculatedSubtotalUsd = 0;

    // 1. Strict Stock and Active Status Validation Guard & Server-Side Price Calculation
    for (const item of dto.items) {
      const productId = item.productId || item.id;
      if (!productId) {
        throw new BadRequestException('شناسه محصول در آیتم‌های سفارش نامعتبر است.');
      }
      // Validates product existence, isActive status, live IRMarket stock, and local database stock
      await this.catalogService.validateLiveStock(String(productId), Number(item.quantity) || 1);

      const prod = await this.prisma.product.findFirst({
        where: {
          OR: [{ id: String(productId) }, { externalId: isNaN(Number(productId)) ? -1 : Number(productId) }],
        },
      });

      if (!prod) {
        throw new BadRequestException(`محصول با شناسه ${productId} یافت نشد.`);
      }

      let unitPriceToman: number;
      if (prod.salePriceToman && prod.salePriceToman > 0) {
        unitPriceToman = prod.salePriceToman;
      } else {
        const pricing = await this.pricingService.calculatePrice(
          prod.costPriceUsd,
          prod.retailPriceUsd,
          prod.customMarginPercent,
          prod.pricingUnit,
        );
        unitPriceToman = pricing.finalToman;
      }

      const qty = Number(item.quantity) || 1;
      calculatedSubtotalToman += unitPriceToman * qty;
      calculatedSubtotalUsd += prod.costPriceUsd * qty;
    }

    // 2. Server-side coupon verification and discount application
    let discountAppliedToman = 0;
    let finalCalculatedToman = calculatedSubtotalToman;
    let validatedCoupon: any = null;

    if (dto.couponCode) {
      try {
        const couponRes = await this.couponsService.validateCoupon(
          dto.couponCode,
          authenticatedUser?.id,
          authenticatedUser?.phone || dto.customerPhone,
        );
        const coupon = couponRes.coupon;
        if (coupon.minOrderToman && calculatedSubtotalToman < coupon.minOrderToman) {
          throw new BadRequestException(
            `حداقل مبلغ سفارش برای اعمال این کد تخفیف ${new Intl.NumberFormat('fa-IR').format(coupon.minOrderToman)} تومان است.`,
          );
        }
        let discount = Math.round((calculatedSubtotalToman * coupon.discountPercent) / 100);
        if (coupon.maxDiscountToman && discount > coupon.maxDiscountToman) {
          discount = coupon.maxDiscountToman;
        }
        discountAppliedToman = discount;
        finalCalculatedToman = Math.max(0, calculatedSubtotalToman - discount);
        validatedCoupon = coupon;
      } catch (couponErr: any) {
        throw new BadRequestException(couponErr?.message || 'کد تخفیف نامعتبر یا منقضی شده است.');
      }
    }

    // Guard against client price tampering (CRIT-01)
    if (Math.abs(finalCalculatedToman - dto.totalPriceToman) > 500) {
      this.logger.warn(
        `Price tampering detected for order ${dto.orderNumber || 'new'}: Client sent ${dto.totalPriceToman}, Server calculated ${finalCalculatedToman}`,
      );
      throw new BadRequestException(
        'مبلغ سفارش با قیمت‌های روز سامانه همخوانی ندارد. لطفاً سبد خرید را مجدداً بروزرسانی فرمایید.',
      );
    }

    const orderNumber = dto.orderNumber || `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

    const isHybrid = Boolean(dto.isHybridOrder);
    let deliveryType = dto.deliveryType || 'link';
    if (dto.targetAccountEmail || dto.targetAccountPassword || (dto.accountCredentials && dto.accountCredentials.length > 0)) {
      deliveryType = 'account_activation';
    }

    // Initial status MUST always start as pending (CRIT-02)
    const status = 'pending';
    const paymentGateway = dto.paymentGateway || dto.gateway || 'cartbecart';

    const order = await this.prisma.$transaction(async (tx) => {
      // Atomic usage count increment with capacity guard to prevent race conditions & burning on failed orders
      if (validatedCoupon) {
        const updateRes = await tx.coupon.updateMany({
          where: {
            id: validatedCoupon.id,
            isActive: true,
            OR: [
              { maxUsage: null },
              { usageCount: { lt: validatedCoupon.maxUsage } },
            ],
          },
          data: { usageCount: { increment: 1 } },
        });

        if (updateRes.count === 0) {
          throw new BadRequestException('ظرفیت استفاده از این کد تخفیف در حین ثبت سفارش به پایان رسید.');
        }
      }

      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          customerEmail: dto.customerEmail,
          customerPhone: dto.customerPhone || null,
          customerLink: dto.customerLink || null,
          totalPriceToman: finalCalculatedToman,
          totalPriceUsd: calculatedSubtotalUsd,
          status,
          deliveryType,
          targetAccountEmail: dto.targetAccountEmail || dto.accountCredentials?.[0]?.email || null,
          targetAccountPassword: dto.targetAccountPassword || dto.accountCredentials?.[0]?.password || null,
          accountCredentials: dto.accountCredentials ? JSON.stringify(dto.accountCredentials) : null,
          isHybridOrder: isHybrid,
          instantItemsCount: dto.instantItemsCount || 0,
          activationItemsCount: dto.activationItemsCount || 0,
          items: JSON.stringify(dto.items || []),
          deliveredAccounts: null, // CRIT-02: Never accept/store delivered accounts before payment verification
          paymentGateway,
          couponCode: dto.couponCode || null,
          discountAppliedToman,
        },
      });

      // Decrement local inventory stock where applicable
      for (const item of dto.items) {
        const productId = item.productId || item.id;
        const requestedQty = Number(item.quantity) || 1;
        try {
          const prod = await tx.product.findFirst({
            where: {
              OR: [{ id: String(productId) }, { externalId: isNaN(Number(productId)) ? -1 : Number(productId) }],
            },
          });
          if (prod && prod.stockCount !== null) {
            const newStock = Math.max(0, prod.stockCount - requestedQty);
            await tx.product.update({
              where: { id: prod.id },
              data: {
                stockCount: newStock,
                inStock: newStock > 0,
              },
            });
          }
        } catch (stockErr: any) {
          this.logger.warn(`Failed to decrement local stock for product ${productId}: ${stockErr?.message}`);
        }
      }

      return createdOrder;
    });

    // 3. Referral Cashback: Strictly awarded ONLY when the order is confirmed completed/delivered.
    try {
      if (order.status === 'completed' || order.status === 'delivered') {
        await this.awardReferralCashbackIfEligible(order);
      }
    } catch (cashbackErr: any) {
      this.logger.warn(`Referral cashback check notice: ${cashbackErr?.message}`);
    }

    // Trigger non-blocking transactional email in background (never block HTTP response)
    const firstProductTitle =
      dto.items[0]?.productTitle || dto.items[0]?.title || dto.items[0]?.customTitle || 'محصول دیجیتال';

    (async () => {
      try {
        // Do not dispatch product delivery emails for unpaid pending orders
        if (order.status === 'pending') {
          return;
        }

        if (isHybrid) {
          // Mode Hybrid: Deliver instant items immediately & inform customer about remaining activation queue
          await this.emailService.sendOrderReceipt({
            orderNumber,
            customerEmail: dto.customerEmail,
            customerPhone: dto.customerPhone,
            createdAt: new Intl.DateTimeFormat('fa-IR', { dateStyle: 'full', timeStyle: 'short' }).format(new Date()),
            items: (dto.items || []).map((it) => ({
              productTitle: it.productTitle || it.title || it.customTitle || 'محصول دیجیتال',
              quantity: it.quantity,
              priceToman: it.priceToman,
              priceUsd: it.priceUsd,
              durationDays: it.durationDays,
            })),
            deliveredAccounts: dto.deliveredAccounts || [],
            accountCredentials: dto.accountCredentials || [],
            isHybridOrder: true,
            instantItemsCount: dto.instantItemsCount || 0,
            activationItemsCount: dto.activationItemsCount || 0,
            totalPriceToman: dto.totalPriceToman,
            totalPriceUsd: dto.totalPriceUsd,
            paymentGateway: dto.paymentGateway || 'zarinpal',
          });
        } else if (deliveryType === 'account_activation') {
          // Mode 3: Pending admin activation
          await this.emailService.sendDeliveryEmail({
            orderNumber,
            customerEmail: dto.customerEmail,
            productTitle: firstProductTitle,
            deliveryType: 'pending_activation',
            targetAccountEmail: dto.targetAccountEmail || dto.accountCredentials?.[0]?.email,
          });
        } else if (deliveryType === 'link') {
          // Mode 1: Activation link
          const link = dto.deliveredAccounts?.[0] || dto.customerLink || 'https://arzanaccount.com';
          await this.emailService.sendDeliveryEmail({
            orderNumber,
            customerEmail: dto.customerEmail,
            productTitle: firstProductTitle,
            deliveryType: 'link',
            activationLink: link,
          });
        } else {
          // Mode 2: Account credentials
          await this.emailService.sendDeliveryEmail({
            orderNumber,
            customerEmail: dto.customerEmail,
            productTitle: firstProductTitle,
            deliveryType: 'credentials',
            accountCredentials: dto.deliveredAccounts || [],
          });
        }
      } catch (emailErr) {
        this.logger.warn(`Failed to send order delivery email for ${orderNumber}: ${emailErr?.message}`);
      }
    })().catch((err) => {
      this.logger.error(`Background email error for order ${orderNumber}: ${err?.message}`);
    });

    // Dispatch real SMS notification for order creation
    const customerPhone = dto.customerPhone || order.customerPhone;
    if (customerPhone) {
      this.smsService
        .sendOrderCreatedSms(
          customerPhone,
          orderNumber,
          dto.totalPriceToman,
          dto.customerEmail ? dto.customerEmail.split('@')[0] : 'کاربر گرامی',
        )
        .then((res) => {
          if (res.success) {
            this.logger.log(`[SMS ORDER] Sent order creation SMS for #${orderNumber} to ${customerPhone}`);
          }
        })
        .catch((err) => this.logger.warn(`Failed to send order SMS: ${err?.message}`));
    }

    return {
      ...order,
      items: dto.items,
      deliveredAccounts: dto.deliveredAccounts || [],
      accountCredentials: dto.accountCredentials || [],
    };
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto, adminUser?: string) {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
    });

    if (!order) throw new NotFoundException('سفارش یافت نشد.');

    const previousStatus = order.status;
    const isNowCompleted = (dto.status === 'completed' || dto.status === 'delivered') &&
      previousStatus !== 'completed' && previousStatus !== 'delivered';

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: dto.status,
        ...(dto.deliveredAccounts !== undefined
          ? {
              deliveredAccounts: Array.isArray(dto.deliveredAccounts)
                ? JSON.stringify(dto.deliveredAccounts)
                : String(dto.deliveredAccounts),
            }
          : {}),
        approvedByAdminId: dto.adminId || null,
        approvedByAdminName: dto.adminName || 'مدیر سیستم',
        approvedByAdminPhone: dto.adminPhone || null,
        approvedAt: isNowCompleted ? new Date() : order.approvedAt,
      },
    });

    // When status changes to completed/delivered, award referral cashback if eligible
    if (isNowCompleted) {
      await this.awardReferralCashbackIfEligible(updated);
    }

    // When status changes to cancelled/refunded, reverse previously awarded cashback if applicable
    if (dto.status === 'cancelled' || dto.status === 'refunded') {
      await this.reverseReferralCashbackIfApplicable(order);
    }

    // When status changes to refunded, send refund email automatically (background non-blocking)
    if (dto.status === 'refunded' && previousStatus !== 'refunded') {
      const sendRefundEmailAsync = async () => {
        try {
          const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
          const productTitle = items?.[0]?.productTitle || 'سفارش دیجیتال';

          let targetEmail = dto.customerEmail || order.customerEmail;
          if (!targetEmail || !targetEmail.includes('@')) {
            if (order.customerPhone) {
              const u = await this.prisma.user.findFirst({ where: { phone: order.customerPhone } });
              if (u?.email && u.email.includes('@')) targetEmail = u.email;
            }
          }

          if (targetEmail && targetEmail.includes('@')) {
            const isWallet = order.refundMethod === 'wallet';
            const trackingCode = order.refundTrackingCode || (isWallet ? `WALLET-${Date.now().toString().slice(-6)}` : `BANK-${Date.now().toString().slice(-6)}`);
            await this.emailService.sendDeliveryEmail({
              orderNumber: order.orderNumber,
              customerEmail: targetEmail,
              customerName: targetEmail.split('@')[0],
              productTitle,
              deliveryType: 'refund_completed',
              refundAmountToman: order.refundAmountToman || order.totalPriceToman,
              refundTrackingCode: trackingCode,
              refundMethod: (order.refundMethod as any) || 'bank_card',
              refundCardNumber: isWallet ? 'کیف پول کاربری درون سایت' : (order.refundCardNumber || undefined),
              refundReceiptUrl: order.refundReceiptUrl || undefined,
            });
            this.logger.log(`Automatic refund notification email sent to ${targetEmail} for order #${order.orderNumber}`);
          }
        } catch (err: any) {
          this.logger.warn(`Failed to send automated refund email for order #${order.orderNumber}: ${err?.message}`);
        }
      };
      sendRefundEmailAsync().catch((e) => this.logger.warn(`Async refund email error: ${e?.message}`));
    }

    // Mode 3 Completion: Send activation completed email when admin changes status to delivered (background non-blocking)
    if (isNowCompleted && order.deliveryType === 'account_activation') {
      const sendActivationEmailAsync = async () => {
        try {
          const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
          const productTitle = items?.[0]?.productTitle || 'اشتراک دیجیتال';

          await this.emailService.sendDeliveryEmail({
            orderNumber: order.orderNumber,
            customerEmail: order.customerEmail,
            productTitle,
            deliveryType: 'activation_completed',
            targetAccountEmail: order.targetAccountEmail || undefined,
          });
          this.logger.log(`Sent activation completion email for order #${order.orderNumber}`);
        } catch (err: any) {
          this.logger.warn(`Failed to send activation completed email for order #${order.orderNumber}: ${err?.message}`);
        }
      };
      sendActivationEmailAsync().catch((e) => this.logger.warn(`Async activation email error: ${e?.message}`));
    }

    if (isNowCompleted && order.customerPhone) {
      this.smsService
        .sendOrderCompletedSms(
          order.customerPhone,
          order.orderNumber,
          (dto as any).accountCredentials || order.accountCredentials || 'اکانت شما با موفقیت فعال شد.',
        )
        .then((res) => {
          if (res.success) {
            this.logger.log(`[SMS ORDER] Sent order completion SMS for #${order.orderNumber} to ${order.customerPhone}`);
          }
        })
        .catch((err) => this.logger.warn(`Failed to send order completion SMS: ${err?.message}`));
    }

    await this.prisma.auditLog.create({
      data: {
        action: `تغییر وضعیت سفارش #${order.orderNumber} به ${dto.status}`,
        details: `وضعیت سفارش از ${previousStatus} به ${dto.status} توسط ${dto.adminName || 'مدیر سیستم'} تغییر یافت. ${dto.notes || ''}`,
        adminId: dto.adminId || null,
        adminName: dto.adminName || adminUser || 'مدیر سیستم',
        type: 'orders',
      },
    });

    return updated;
  }

  async requestRefund(id: string, dto: RequestRefundDto, requestingUser?: any) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { id },
          { orderNumber: id },
          { id: id.replace('ord-', '') },
        ],
      },
    });

    if (!order) throw new NotFoundException('سفارش یافت نشد.');

    // IDOR Protection: Verify requesting user is the owner or SUPER_ADMIN
    if (requestingUser) {
      const isOwner =
        (requestingUser.email && order.customerEmail && requestingUser.email.toLowerCase() === order.customerEmail.toLowerCase()) ||
        (requestingUser.phone && order.customerPhone && requestingUser.phone === order.customerPhone);
      const isSuperAdmin = requestingUser.role === 'SUPER_ADMIN';
      if (!isOwner && !isSuperAdmin) {
        throw new ForbiddenException('شما مجاز به درخواست عودت وجه برای سفارش کاربر دیگر نیستید.');
      }
    }

    if (order.status === 'refunded') {
      throw new BadRequestException('این سفارش پیش‌تر تسویه و عودت داده شده است.');
    }
    if (order.status === 'refund_requested') {
      throw new BadRequestException('درخواست عودت وجه برای این سفارش قبلاً ثبت شده و در حال بررسی است.');
    }

    // Card hijacking protection: Verify card belongs to user if they have saved bank cards
    if (dto.refundCardNumber && requestingUser?.id) {
      const userRecord = await this.prisma.user.findUnique({ where: { id: requestingUser.id } });
      if (userRecord && userRecord.bankCardsJson) {
        try {
          const userCards: any[] = JSON.parse(userRecord.bankCardsJson);
          if (Array.isArray(userCards) && userCards.length > 0) {
            const cleanCard = dto.refundCardNumber.replace(/\D/g, '');
            const cardMatches = userCards.some((c: any) => {
              const savedNumber = (c.cardNumber || c.number || '').replace(/\D/g, '');
              return savedNumber && (savedNumber === cleanCard || cleanCard.endsWith(savedNumber.slice(-4)));
            });
            if (!cardMatches && requestingUser.role !== 'SUPER_ADMIN') {
              throw new BadRequestException('شماره کارت عودت وجه باید با یکی از کارت‌های بانکی ثبت‌شده در پروفایل شما مطابقت داشته باشد.');
            }
          }
        } catch (err: any) {
          if (err instanceof BadRequestException) throw err;
        }
      }
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'refund_requested', // تغییر وضعیت سفارش به حالت درخواست عودت داده شده
        refundReason: dto.refundReason,
        refundCardNumber: dto.refundCardNumber || null,
        refundIban: dto.refundIban || null,
        refundAmountToman: order.totalPriceToman,
        refundRejectionReason: null,
      },
    });

    // If referral cashback was previously awarded for this order, reverse it while under review
    await this.reverseReferralCashbackIfApplicable(order);

    await this.prisma.auditLog.create({
      data: {
        action: `ثبت درخواست لغو و عودت وجه برای سفارش #${order.orderNumber}`,
        details: `کاربر درخواست عودت وجه سفارش #${order.orderNumber} به مبلغ ${new Intl.NumberFormat('fa-IR').format(order.totalPriceToman)} تومان را به دلیل "${dto.refundReason}" ثبت نمود. وضعیت سفارش به "درخواست عودت داده شده" تغییر یافت و در پنل مدیریت عودت‌ها قرار گرفت.`,
        user: order.customerEmail,
        type: 'orders',
      },
    });

    return updated;
  }

  async getRefundRequests() {
    const orders = await this.prisma.order.findMany({
      where: {
        OR: [
          { status: 'refund_requested' },
          { status: 'refunded' },
          { status: 'cancelled' },
          { refundReason: { not: null } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    return orders.map(o => ({
      ...o,
      items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items,
      deliveredAccounts: o.deliveredAccounts ? JSON.parse(o.deliveredAccounts) : [],
    }));
  }

  async processRefund(dto: ProcessRefundDto) {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id: dto.orderId }, { orderNumber: dto.orderId }] },
    });

    if (!order) throw new NotFoundException('سفارش مورد نظر یافت نشد.');

    if (order.status === 'refunded') {
      throw new BadRequestException('این سفارش پیش‌تر تسویه و عودت داده شده است.');
    }

    if (dto.refundAmountToman > order.totalPriceToman || dto.refundAmountToman <= 0) {
      throw new BadRequestException('مبلغ عودت وجه نامعتبر بوده یا از مبلغ کل سفارش بیشتر است.');
    }

    const isWalletRefund = dto.refundMethod === 'wallet';
    const trackingCode = isWalletRefund
      ? (dto.refundTrackingCode || `WALLET-REFUND-${Date.now().toString().slice(-6)}`)
      : (dto.refundTrackingCode || `BANK-${Date.now().toString().slice(-6)}`);

    // If wallet refund, credit the customer's wallet balance directly in the database
    if (isWalletRefund) {
      const userConditions: any[] = [];
      if (order.customerPhone) userConditions.push({ phone: order.customerPhone });
      if (order.customerEmail) userConditions.push({ email: order.customerEmail });

      if (userConditions.length > 0) {
        const customer = await this.prisma.user.findFirst({
          where: { OR: userConditions },
        });

        if (customer) {
          const currentDirect = customer.directDepositBalance || 0;
          const currentBonus = customer.cashbackBonusBalance || 0;
          const newDirect = currentDirect + dto.refundAmountToman;
          const newTotalWallet = newDirect + currentBonus;

          await this.prisma.user.update({
            where: { id: customer.id },
            data: {
              directDepositBalance: newDirect,
              walletBalanceToman: newTotalWallet,
            },
          });

          await this.prisma.auditLog.create({
            data: {
              action: `شارژ کیف پول خریدار بابت عودت وجه سفارش #${order.orderNumber}`,
              details: `مبلغ ${new Intl.NumberFormat('fa-IR').format(dto.refundAmountToman)} تومان بابت عودت وجه سفارش #${order.orderNumber} مستقیماً به کیف پول کاربر ${customer.name} (${customer.phone || customer.email}) واریز گردید. موجودی جدید: ${newTotalWallet} تومان.`,
              user: dto.adminName || 'مدیر مالی',
              type: 'finance',
            },
          });

          this.logger.log(`[WALLET REFUND] Credited ${dto.refundAmountToman} Toman to user ${customer.name} for order #${order.orderNumber}`);
        }
      }
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'refunded',
        refundAmountToman: dto.refundAmountToman,
        refundTrackingCode: trackingCode,
        refundMethod: isWalletRefund ? 'wallet' : 'bank_card',
        refundReceiptUrl: dto.refundReceiptUrl || null,
        refundCardNumber: isWalletRefund ? 'کیف پول درون سایت' : (dto.refundCardNumber || order.refundCardNumber),
        refundIban: isWalletRefund ? null : (dto.refundIban || order.refundIban),
        refundedAt: new Date(),
        refundedByAdminId: dto.adminId || null,
        refundedByAdminName: dto.adminName || 'مدیر مالی',
      },
    });

    // Reverse cashback if not already done
    await this.reverseReferralCashbackIfApplicable(order);

    // Send refund completion email in background (non-blocking)
    const sendRefundEmailAsync = async () => {
      try {
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        const productTitle = items?.[0]?.productTitle || 'سفارش دیجیتال';

        let targetEmail = dto.customerEmail || order.customerEmail;
        if (!targetEmail || !targetEmail.includes('@')) {
          if (order.customerPhone) {
            const u = await this.prisma.user.findFirst({ where: { phone: order.customerPhone } });
            if (u?.email && u.email.includes('@')) targetEmail = u.email;
          }
        }

        if (targetEmail && targetEmail.includes('@')) {
          await this.emailService.sendDeliveryEmail({
            orderNumber: order.orderNumber,
            customerEmail: targetEmail,
            customerName: targetEmail.split('@')[0],
            productTitle,
            deliveryType: 'refund_completed',
            refundAmountToman: dto.refundAmountToman,
            refundTrackingCode: trackingCode,
            refundMethod: isWalletRefund ? 'wallet' : 'bank_card',
            refundCardNumber: isWalletRefund ? 'کیف پول کاربری درون سایت' : (dto.refundCardNumber || order.refundCardNumber || undefined),
            refundReceiptUrl: dto.refundReceiptUrl || undefined,
          });
          this.logger.log(`[REFUND EMAIL] Refund confirmation email dispatched to ${targetEmail} for order #${order.orderNumber}`);
        } else {
          this.logger.warn(`[REFUND EMAIL] No valid email found for customer of order #${order.orderNumber}. Email notification skipped.`);
        }
      } catch (emailErr: any) {
        this.logger.warn(`Failed to send refund email: ${emailErr?.message}`);
      }
    };
    sendRefundEmailAsync().catch((err) => this.logger.warn(`Async processRefund email error: ${err?.message}`));

    // Dispatch real SMS refund notification
    if (order.customerPhone) {
      this.smsService
        .sendOrderRefundedSms(
          order.customerPhone,
          order.orderNumber,
          dto.refundAmountToman,
          trackingCode,
        )
        .then((res) => {
          if (res.success) {
            this.logger.log(`[SMS REFUND] Refund SMS sent to ${order.customerPhone}`);
          }
        })
        .catch((err) => this.logger.warn(`Failed to send refund SMS: ${err?.message}`));
    }

    await this.prisma.auditLog.create({
      data: {
        action: `تسویه و عودت وجه سفارش #${order.orderNumber} (${isWalletRefund ? 'به کیف پول سایت' : 'به حساب بانکی'})`,
        details: `مبلغ ${dto.refundAmountToman} تومان ${isWalletRefund ? 'به کیف پول سایت کاربر' : `با کد رهگیری ${trackingCode} به حساب بانکی`} توسط ${dto.adminName || 'مدیر مالی'} عودت داده شد.`,
        adminId: dto.adminId || null,
        adminName: dto.adminName || 'مدیر مالی',
        type: 'orders_approval',
      },
    });

    return updated;
  }

  /**
   * Admin rejects customer's refund request and returns order to completed or original status.
   */
  async rejectRefund(id: string, dto: RejectRefundDto) {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }, { id: id.replace('ord-', '') }] },
    });

    if (!order) throw new NotFoundException('سفارش مورد نظر یافت نشد.');

    const returnStatus = dto.newStatus || 'completed';

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: returnStatus,
        refundRejectionReason: dto.rejectionReason,
      },
    });

    // If order is back to completed/delivered, award referral cashback if eligible
    if (returnStatus === 'completed' || returnStatus === 'delivered') {
      await this.awardReferralCashbackIfEligible(updated);
    }

    // Dispatch real SMS rejection notification
    if (order.customerPhone) {
      this.smsService.getSmsConfig().then((cfg) => {
        if (cfg.patternOrderRefunded) {
          this.smsService
            .sendPatternSms(
              order.customerPhone!,
              cfg.patternOrderRefunded,
              [order.orderNumber, dto.rejectionReason || 'عدم تایید شرایط عودت'],
              'refund_rejected',
            )
            .catch((err) => this.logger.warn(`Failed to send refund reject SMS: ${err?.message}`));
        }
      });
    }

    await this.prisma.auditLog.create({
      data: {
        action: `مخالفت با درخواست عودت وجه سفارش #${order.orderNumber}`,
        details: `درخواست عودت وجه سفارش #${order.orderNumber} توسط ${dto.adminName || 'مدیر سیستم'} رد شد. دلیل: "${dto.rejectionReason}". وضعیت سفارش به "${returnStatus}" بازگردانده شد.`,
        adminId: dto.adminId || null,
        adminName: dto.adminName || 'مدیر سیستم',
        type: 'orders',
      },
    });

    return updated;
  }

  /**
   * Award referral cashback to inviter ONLY when order is confirmed completed/delivered.
   */
  async awardReferralCashbackIfEligible(order: any) {
    try {
      if (order.status !== 'completed' && order.status !== 'delivered') {
        return;
      }

      // Guard against duplicate payout for the same order
      const alreadyAwarded = await this.prisma.auditLog.findFirst({
        where: {
          action: 'واریز پاداش دعوت از دوستان (کش‌بک زیرمجموعه)',
          details: { contains: `#${order.orderNumber}` },
        },
      });

      if (alreadyAwarded) {
        return;
      }

      const userConditions: any[] = [];
      if (order.customerPhone) userConditions.push({ phone: order.customerPhone });
      if (order.customerEmail) userConditions.push({ email: order.customerEmail });

      if (userConditions.length === 0) return;

      const matchedUser = await this.prisma.user.findFirst({
        where: { OR: userConditions },
      });

      if (!matchedUser || !matchedUser.referredByCode) return;

      const inviter = await this.prisma.user.findFirst({
        where: {
          OR: [
            { referralCode: matchedUser.referredByCode },
            { id: matchedUser.referredByCode },
          ],
        },
      });

      if (!inviter || inviter.id === matchedUser.id) return;

      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: 'ORDER_CASHBACK_PERCENT' },
      });
      const cashbackPercent = setting?.value ? parseInt(setting.value, 10) : 10;

      if (cashbackPercent > 0 && order.totalPriceToman > 0) {
        const cashbackAmount = Math.round(Number(order.totalPriceToman) * (cashbackPercent / 100));
        if (cashbackAmount > 0) {
          const prevBonus = inviter.cashbackBonusBalance || 0;
          const prevDirect = inviter.directDepositBalance || 0;
          const newBonus = prevBonus + cashbackAmount;
          const newTotalWallet = prevDirect + newBonus;

          await this.prisma.user.update({
            where: { id: inviter.id },
            data: {
              cashbackBonusBalance: newBonus,
              walletBalanceToman: newTotalWallet,
            },
          });

          await this.prisma.auditLog.create({
            data: {
              action: 'واریز پاداش دعوت از دوستان (کش‌بک زیرمجموعه)',
              details: `مبلغ ${new Intl.NumberFormat('fa-IR').format(cashbackAmount)} تومان پاداش کش‌بک خرید کاربر ${matchedUser.name} (سفارش #${order.orderNumber} با نرخ %${cashbackPercent} پس از تکمیل سفارش) به کیف پول معرف ایشان (${inviter.name}) منظور شد.`,
              user: inviter.name,
              type: 'finance',
            },
          });

          this.logger.log(
            `[REFERRAL CASHBACK] Order #${order.orderNumber} completed: Awarded ${cashbackAmount} Toman to inviter ${inviter.name} (${inviter.id}) for purchase by ${matchedUser.name}`
          );
        }
      }
    } catch (cashbackErr: any) {
      this.logger.warn(`Failed to process referral cashback for order #${order?.orderNumber}: ${cashbackErr?.message}`);
    }
  }

  /**
   * Reverses referral cashback bonus if an order is cancelled or refunded after payout.
   */
  async reverseReferralCashbackIfApplicable(order: any) {
    try {
      const awardLog = await this.prisma.auditLog.findFirst({
        where: {
          action: 'واریز پاداش دعوت از دوستان (کش‌بک زیرمجموعه)',
          details: { contains: `#${order.orderNumber}` },
        },
      });

      if (!awardLog) return; // Never awarded, nothing to reverse

      const alreadyReversed = await this.prisma.auditLog.findFirst({
        where: {
          action: 'کسر پاداش دعوت از دوستان (لغو/عودت سفارش)',
          details: { contains: `#${order.orderNumber}` },
        },
      });

      if (alreadyReversed) return;

      const userConditions: any[] = [];
      if (order.customerPhone) userConditions.push({ phone: order.customerPhone });
      if (order.customerEmail) userConditions.push({ email: order.customerEmail });

      const matchedUser = await this.prisma.user.findFirst({
        where: { OR: userConditions },
      });

      if (!matchedUser || !matchedUser.referredByCode) return;

      const inviter = await this.prisma.user.findFirst({
        where: {
          OR: [
            { referralCode: matchedUser.referredByCode },
            { id: matchedUser.referredByCode },
          ],
        },
      });

      if (!inviter) return;

      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: 'ORDER_CASHBACK_PERCENT' },
      });
      const cashbackPercent = setting?.value ? parseInt(setting.value, 10) : 10;
      const cashbackAmount = Math.round(Number(order.totalPriceToman) * (cashbackPercent / 100));

      if (cashbackAmount > 0) {
        const prevBonus = inviter.cashbackBonusBalance || 0;
        const prevDirect = inviter.directDepositBalance || 0;
        const newBonus = Math.max(0, prevBonus - cashbackAmount);
        const newTotalWallet = Math.max(0, prevDirect + newBonus);

        await this.prisma.user.update({
          where: { id: inviter.id },
          data: {
            cashbackBonusBalance: newBonus,
            walletBalanceToman: newTotalWallet,
          },
        });

        await this.prisma.auditLog.create({
          data: {
            action: 'کسر پاداش دعوت از دوستان (لغو/عودت سفارش)',
            details: `مبلغ ${new Intl.NumberFormat('fa-IR').format(cashbackAmount)} تومان پاداش کش‌بک سفارش #${order.orderNumber} به دلیل لغو/عودت وجه سفارش از کیف پول معرف (${inviter.name}) کسر گردید.`,
            user: inviter.name,
            type: 'finance',
          },
        });

        this.logger.log(
          `[REFERRAL CASHBACK REVERSED] Deducted ${cashbackAmount} Toman from inviter ${inviter.name} due to cancellation of order #${order.orderNumber}`
        );
      }
    } catch (err: any) {
      this.logger.warn(`Failed to reverse referral cashback for order #${order?.orderNumber}: ${err?.message}`);
    }
  }
}
