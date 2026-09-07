import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { CreateCategoryDto, UpdateProductDto } from './catalog.dto';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
  ) {}

  async getProducts(params?: {
    isActive?: boolean;
    categoryId?: string;
    search?: string;
    isFlashDeal?: boolean;
    isFeatured?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    if (params?.categoryId) {
      where.categoryId = params.categoryId;
    }

    if (params?.isFlashDeal !== undefined) {
      where.isFlashDeal = params.isFlashDeal;
    }

    if (params?.isFeatured !== undefined) {
      where.isFeatured = params.isFeatured;
    }

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search } },
        { customTitle: { contains: params.search } },
        { description: { contains: params.search } },
      ];
    }

    const [products, totalCount] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: [{ isFeatured: 'desc' }, { rating: 'desc' }, { createdAt: 'desc' }],
        take: params?.limit ? Number(params.limit) : 50,
        skip: params?.offset ? Number(params.offset) : 0,
      }),
      this.prisma.product.count({ where }),
    ]);

    // Attach calculated prices
    const enriched = await Promise.all(
      products.map(async (p) => {
        const price = await this.pricingService.calculatePrice(
          p.costPriceUsd,
          p.retailPriceUsd,
          p.customMarginPercent,
          p.pricingUnit,
        );
        return {
          ...p,
          calculatedPrice: price,
        };
      }),
    );

    return {
      products: enriched,
      totalCount,
    };
  }

  async getProductById(id: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [{ id }, { externalId: isNaN(Number(id)) ? -1 : Number(id) }],
      },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException(`محصول با شناسه ${id} یافت نشد.`);
    }

    const price = await this.pricingService.calculatePrice(
      product.costPriceUsd,
      product.retailPriceUsd,
      product.customMarginPercent,
      product.pricingUnit,
    );

    return {
      ...product,
      calculatedPrice: price,
    };
  }

  async toggleProductActive(id: string, user = 'مدیر سیستم') {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('محصول یافت نشد.');

    const nextState = !product.isActive;
    const updated = await this.prisma.product.update({
      where: { id },
      data: { isActive: nextState },
    });

    // Log in AuditLog
    await this.prisma.auditLog.create({
      data: {
        action: nextState ? 'فعال‌سازی محصول در سایت' : 'غیرفعال‌سازی محصول',
        details: `محصول ${product.customTitle} (${product.name}) به حالت ${nextState ? 'فعال' : 'غیرفعال'} تغییر یافت.`,
        user,
        type: 'product_toggle',
      },
    });

    return updated;
  }

  async updateProduct(id: string, dto: UpdateProductDto, user = 'مدیر سیستم') {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('محصول یافت نشد.');

    const { user: userFromDto, ...dataToUpdate } = dto;
    const author = userFromDto || user || 'مدیر سیستم';

    const updated = await this.prisma.product.update({
      where: { id },
      data: dataToUpdate,
    });

    await this.prisma.auditLog.create({
      data: {
        action: `ویرایش مشخصات محصول #${product.externalId}`,
        details: `تغییرات روی محصول ${updated.customTitle} اعمال گردید.`,
        user: author,
        type: 'product_toggle',
      },
    });

    return updated;
  }

  async getCategories() {
    const categories = await this.prisma.category.findMany({
      orderBy: { orderIndex: 'asc' },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return categories;
  }

  async createCategory(dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: dto,
    });
  }

  async deleteCategory(id: string) {
    return this.prisma.category.delete({
      where: { id },
    });
  }
}
