import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateOrderDto, UpdateOrderStatusDto, ProcessRefundDto, RequestRefundDto } from './orders.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async getOrders(params?: { status?: string; customerEmail?: string; limit?: number; offset?: number }) {
    const where: any = {};
    if (params?.status) where.status = params.status;
    if (params?.customerEmail) where.customerEmail = params.customerEmail;

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

  async createOrder(dto: CreateOrderDto) {
    const orderNumber = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

    const isHybrid = Boolean(dto.isHybridOrder);
    let deliveryType = dto.deliveryType || 'link';
    if (dto.targetAccountEmail || dto.targetAccountPassword || (dto.accountCredentials && dto.accountCredentials.length > 0)) {
      deliveryType = 'account_activation';
    }

    const firstProductTitle = dto.items?.[0]?.productTitle || 'اشتراک دیجیتال';
    const status = (deliveryType === 'account_activation' || isHybrid) ? 'processing' : 'delivered';

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        customerEmail: dto.customerEmail,
        customerPhone: dto.customerPhone || null,
        customerLink: dto.customerLink || null,
        totalPriceToman: dto.totalPriceToman,
        totalPriceUsd: dto.totalPriceUsd,
        status,
        deliveryType,
        targetAccountEmail: dto.targetAccountEmail || dto.accountCredentials?.[0]?.email || null,
        targetAccountPassword: dto.targetAccountPassword || dto.accountCredentials?.[0]?.password || null,
        accountCredentials: dto.accountCredentials ? JSON.stringify(dto.accountCredentials) : null,
        isHybridOrder: isHybrid,
        instantItemsCount: dto.instantItemsCount || 0,
        activationItemsCount: dto.activationItemsCount || 0,
        items: JSON.stringify(dto.items || []),
        deliveredAccounts: dto.deliveredAccounts ? JSON.stringify(dto.deliveredAccounts) : null,
        paymentGateway: dto.paymentGateway || 'zarinpal',
      },
    });

    // Trigger initial transactional email
    try {
      if (isHybrid) {
        // Mode Hybrid: Deliver instant items immediately & inform customer about remaining activation queue
        await this.emailService.sendOrderReceipt({
          orderNumber,
          customerEmail: dto.customerEmail,
          customerPhone: dto.customerPhone,
          createdAt: new Intl.DateTimeFormat('fa-IR', { dateStyle: 'full', timeStyle: 'short' }).format(new Date()),
          items: dto.items || [],
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

    return {
      ...order,
      items: dto.items,
      deliveredAccounts: dto.deliveredAccounts || [],
      accountCredentials: dto.accountCredentials || [],
    };
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
    });

    if (!order) throw new NotFoundException('سفارش یافت نشد.');

    const previousStatus = order.status;
    const isNowCompleted = dto.status === 'delivered' && previousStatus !== 'delivered';

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: dto.status,
        approvedByAdminId: dto.adminId || null,
        approvedByAdminName: dto.adminName || 'مدیر سیستم',
        approvedByAdminPhone: dto.adminPhone || null,
        approvedAt: isNowCompleted ? new Date() : order.approvedAt,
      },
    });

    // Mode 3 Completion: Send activation completed email when admin changes status to delivered
    if (isNowCompleted && order.deliveryType === 'account_activation') {
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
      } catch (err) {
        this.logger.warn(`Failed to send activation completed email for order #${order.orderNumber}: ${err?.message}`);
      }
    }

    await this.prisma.auditLog.create({
      data: {
        action: `تغییر وضعیت سفارش #${order.orderNumber} به ${dto.status}`,
        details: `وضعیت سفارش از ${previousStatus} به ${dto.status} توسط ${dto.adminName || 'مدیر سیستم'} تغییر یافت. ${dto.notes || ''}`,
        adminId: dto.adminId || null,
        adminName: dto.adminName || 'مدیر سیستم',
        type: 'orders',
      },
    });

    return updated;
  }

  async requestRefund(id: string, dto: RequestRefundDto) {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
    });

    if (!order) throw new NotFoundException('سفارش یافت نشد.');

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'refund_requested',
        refundReason: dto.refundReason,
        refundCardNumber: dto.refundCardNumber || null,
        refundIban: dto.refundIban || null,
        refundAmountToman: order.totalPriceToman,
      },
    });

    return updated;
  }

  async getRefundRequests() {
    const orders = await this.prisma.order.findMany({
      where: {
        status: {
          in: ['refund_requested', 'refunded'],
        },
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

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'refunded',
        refundAmountToman: dto.refundAmountToman,
        refundCardNumber: dto.refundCardNumber || order.refundCardNumber,
        refundIban: dto.refundIban || order.refundIban,
        refundTrackingCode: dto.refundTrackingCode,
        refundReceiptUrl: dto.refundReceiptUrl || null,
        refundedAt: new Date(),
        refundedByAdminId: dto.adminId || null,
        refundedByAdminName: dto.adminName || 'مدیر مالی',
      },
    });

    // Send refund completion email
    try {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      const productTitle = items?.[0]?.productTitle || 'سفارش دیجیتال';

      await this.emailService.sendDeliveryEmail({
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
        productTitle,
        deliveryType: 'refund_completed',
        refundAmountToman: dto.refundAmountToman,
        refundTrackingCode: dto.refundTrackingCode,
        refundCardNumber: dto.refundCardNumber || order.refundCardNumber || undefined,
      });
    } catch (emailErr) {
      this.logger.warn(`Failed to send refund email: ${emailErr?.message}`);
    }

    await this.prisma.auditLog.create({
      data: {
        action: `تسویه و عودت وجه سفارش #${order.orderNumber}`,
        details: `مبلغ ${dto.refundAmountToman} تومان با کد رهگیری ${dto.refundTrackingCode} توسط ${dto.adminName || 'مدیر مالی'} عودت داده شد.`,
        adminId: dto.adminId || null,
        adminName: dto.adminName || 'مدیر مالی',
        type: 'orders_approval',
      },
    });

    return updated;
  }
}
