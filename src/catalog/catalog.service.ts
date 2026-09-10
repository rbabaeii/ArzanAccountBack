import { Injectable, NotFoundException, BadRequestException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { IrMarketService } from '../irmarket/irmarket.service';
import { SearchService } from '../search/search.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  UpdateProductDto,
  CreateProductDto,
  CreateTagDto,
  RenameTagDto,
  AssignTagDto,
} from './catalog.dto';

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    private readonly irMarketService: IrMarketService,
    @Optional() private readonly searchService?: SearchService,
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
        let tags: string[] = [];
        if (p.tags) {
          try {
            tags = p.tags.startsWith('[') ? JSON.parse(p.tags) : p.tags.split(',').map((t: string) => t.trim());
          } catch {
            tags = p.tags.split(',').map((t: string) => t.trim());
          }
        }

        return {
          ...p,
          tags,
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

    let tags: string[] = [];
    if (product.tags) {
      try {
        tags = product.tags.startsWith('[') ? JSON.parse(product.tags) : product.tags.split(',').map((t: string) => t.trim());
      } catch {
        tags = product.tags.split(',').map((t: string) => t.trim());
      }
    }

    return {
      ...product,
      tags,
      calculatedPrice: price,
    };
  }

  /**
   * Fetches real-time stock, price and status from irMarket for this specific product
   * and updates local cache/database records.
   */
  async getLiveProduct(id: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [{ id }, { externalId: isNaN(Number(id)) ? -1 : Number(id) }],
      },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException(`محصول با شناسه ${id} یافت نشد.`);
    }

    let isLiveSynced = false;
    let liveProductRecord = product;

    try {
      const raw = await this.irMarketService.getProduct(product.externalId);
      const item = (raw as any)?.product || raw;

      if (item && item.id) {
        const liveInStock = Boolean(item.in_stock);
        const liveStockCount = typeof item.stock === 'number' ? item.stock : product.stockCount;
        const liveCostUsd = typeof item.price_usd === 'number' ? item.price_usd : product.costPriceUsd;
        const liveRetailUsd = typeof item.retail_usd === 'number' ? item.retail_usd : product.retailPriceUsd;
        const liveRequiresEmail = typeof item.requires_email === 'boolean' ? item.requires_email : product.requiresEmail;
        const liveRequiresPassword = typeof item.requires_password === 'boolean' ? item.requires_password : product.requiresPassword;

        liveProductRecord = await this.prisma.product.update({
          where: { id: product.id },
          data: {
            inStock: liveInStock,
            stockCount: liveStockCount,
            costPriceUsd: liveCostUsd,
            retailPriceUsd: liveRetailUsd,
            requiresEmail: liveRequiresEmail,
            requiresPassword: liveRequiresPassword,
          },
          include: { category: true },
        });

        isLiveSynced = true;
        this.logger.log(`[LIVE SYNC] Product #${product.externalId} synced: inStock=${liveInStock}, stock=${liveStockCount}, cost=$${liveCostUsd}`);
      }
    } catch (error) {
      this.logger.warn(`[LIVE SYNC FALLBACK] Could not live-sync product #${product.externalId}: ${error?.message}`);
    }

    const price = await this.pricingService.calculatePrice(
      liveProductRecord.costPriceUsd,
      liveProductRecord.retailPriceUsd,
      liveProductRecord.customMarginPercent,
      liveProductRecord.pricingUnit,
    );

    let tags: string[] = [];
    if (liveProductRecord.tags) {
      try {
        tags = liveProductRecord.tags.startsWith('[')
          ? JSON.parse(liveProductRecord.tags)
          : liveProductRecord.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      } catch {
        tags = liveProductRecord.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      }
    }

    return {
      ...liveProductRecord,
      tags,
      calculatedPrice: price,
      isLiveSynced,
    };
  }

  /**
   * Pre-payment stock validator.
   * Guarantees that the product is currently in stock at irMarket before taking payment.
   */
  async validateLiveStock(id: string, quantity = 1) {
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [{ id }, { externalId: isNaN(Number(id)) ? -1 : Number(id) }],
      },
    });

    if (!product) {
      throw new NotFoundException(`محصول با شناسه ${id} یافت نشد.`);
    }

    if (!product.isActive) {
      throw new BadRequestException(`محصول «${product.customTitle}» در حال حاضر غیرفعال و غیرقابل سفارش است.`);
    }

    try {
      const raw = await this.irMarketService.getProduct(product.externalId);
      const item = (raw as any)?.product || raw;

      if (item && item.id) {
        const liveInStock = Boolean(item.in_stock);
        const liveStock = typeof item.stock === 'number' ? item.stock : 0;

        // Synchronize state
        await this.prisma.product.update({
          where: { id: product.id },
          data: {
            inStock: liveInStock,
            stockCount: liveStock,
          },
        });

        if (!liveInStock || (liveStock > 0 && liveStock < quantity)) {
          throw new BadRequestException(
            `متأسفانه در لحظه پرداخت، موجودی محصول «${product.customTitle}» نزد تأمین‌کننده به پایان رسیده است.`
          );
        }

        return {
          valid: true,
          productId: product.id,
          externalId: product.externalId,
          inStock: liveInStock,
          stockCount: liveStock,
        };
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(`Could not verify live stock with supplier for product #${product.externalId}: ${err?.message}`);
    }

    // Fallback to local stock
    if (!product.inStock || (product.stockCount !== null && product.stockCount < quantity)) {
      throw new BadRequestException(
        `متأسفانه در حال حاضر موجودی محصول «${product.customTitle}» به اتمام رسیده است.`
      );
    }

    return {
      valid: true,
      productId: product.id,
      externalId: product.externalId,
      inStock: product.inStock,
      stockCount: product.stockCount,
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

  async createProduct(dto: CreateProductDto, user = 'مدیر سیستم') {
    const { user: userFromDto, ...productData } = dto;
    const author = userFromDto || user || 'مدیر سیستم';

    const highestProduct = await this.prisma.product.findFirst({
      orderBy: { externalId: 'desc' },
      select: { externalId: true },
    });
    const nextExternalId = (highestProduct?.externalId ? highestProduct.externalId + 1 : 10001);

    let formattedTags: string | null = null;
    if (productData.tags) {
      if (Array.isArray(productData.tags)) {
        formattedTags = JSON.stringify(productData.tags.map((t: any) => String(t).trim()).filter(Boolean));
      } else if (typeof productData.tags === 'string') {
        const trimmed = productData.tags.trim();
        if (trimmed.startsWith('[')) {
          formattedTags = trimmed;
        } else {
          formattedTags = JSON.stringify(trimmed.split(',').map((t: string) => t.trim()).filter(Boolean));
        }
      }
    }

    const created = await this.prisma.product.create({
      data: {
        ...productData,
        externalId: nextExternalId,
        name: productData.name || productData.customTitle,
        tags: formattedTags,
        costPriceUsd: productData.costPriceUsd,
        retailPriceUsd: productData.retailPriceUsd ?? productData.costPriceUsd,
        customMarginPercent: productData.customMarginPercent ?? 15,
        inStock: productData.inStock !== false,
        isActive: productData.isActive ?? false,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: `افزودن محصول جدید #${created.externalId}`,
        details: `محصول جدید «${created.customTitle}» با موفقیت ثبت گردید.`,
        user: author,
        type: 'product_toggle',
      },
    });

    if (this.searchService) {
      this.searchService.reindexAll().catch((err) => {
        this.logger.warn(`Search reindex after product create failed: ${err?.message}`);
      });
    }

    return created;
  }

  async updateProduct(id: string, dto: UpdateProductDto, user = 'مدیر سیستم') {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('محصول یافت نشد.');

    const { user: userFromDto, ...dataToUpdate } = dto;
    const author = userFromDto || user || 'مدیر سیستم';

    if (dataToUpdate.tags !== undefined) {
      if (Array.isArray(dataToUpdate.tags)) {
        dataToUpdate.tags = JSON.stringify(dataToUpdate.tags.map((t: any) => String(t).trim()).filter(Boolean));
      } else if (typeof dataToUpdate.tags === 'string') {
        const trimmed = dataToUpdate.tags.trim();
        if (trimmed.startsWith('[')) {
          dataToUpdate.tags = trimmed;
        } else {
          dataToUpdate.tags = JSON.stringify(trimmed.split(',').map((t: string) => t.trim()).filter(Boolean));
        }
      } else if (dataToUpdate.tags === null) {
        dataToUpdate.tags = null;
      }
    }

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

    if (this.searchService) {
      this.searchService.reindexAll().catch((err) => {
        this.logger.warn(`Search reindex after product update failed: ${err?.message}`);
      });
    }

    return updated;
  }

  /**
   * Get all unique tags with count and sample products
   */
  async getAllTags() {
    const products = await this.prisma.product.findMany({
      select: {
        id: true,
        customTitle: true,
        name: true,
        tags: true,
        isActive: true,
      },
    });

    const tagMap = new Map<string, { name: string; count: number; sampleProducts: { id: string; title: string }[] }>();

    for (const p of products) {
      if (!p.tags) continue;
      let tagsList: string[] = [];
      try {
        if (p.tags.startsWith('[')) {
          tagsList = JSON.parse(p.tags);
        } else {
          tagsList = p.tags.split(',').map((t) => t.trim()).filter(Boolean);
        }
      } catch {
        tagsList = p.tags.split(',').map((t) => t.trim()).filter(Boolean);
      }

      for (const t of tagsList) {
        const clean = t.trim();
        if (!clean) continue;
        if (!tagMap.has(clean)) {
          tagMap.set(clean, {
            name: clean,
            count: 0,
            sampleProducts: [],
          });
        }
        const item = tagMap.get(clean)!;
        item.count += 1;
        if (item.sampleProducts.length < 5) {
          item.sampleProducts.push({
            id: p.id,
            title: p.customTitle || p.name,
          });
        }
      }
    }

    return Array.from(tagMap.values()).sort((a, b) => b.count - a.count);
  }

  /**
   * Create a new tag (and optionally assign to products)
   */
  async createTag(dto: CreateTagDto, user = 'مدیر سیستم') {
    const tag = dto.tag.trim();
    if (!tag) throw new BadRequestException('عنوان برچسب نمی‌تواند خالی باشد.');

    let affectedCount = 0;
    if (dto.productIds && dto.productIds.length > 0) {
      const products = await this.prisma.product.findMany({
        where: { id: { in: dto.productIds } },
      });

      for (const p of products) {
        let currentTags: string[] = [];
        if (p.tags) {
          try {
            currentTags = p.tags.startsWith('[') ? JSON.parse(p.tags) : p.tags.split(',').map((t) => t.trim());
          } catch {
            currentTags = p.tags.split(',').map((t) => t.trim());
          }
        }
        if (!currentTags.includes(tag)) {
          currentTags.push(tag);
          await this.prisma.product.update({
            where: { id: p.id },
            data: { tags: JSON.stringify(currentTags) },
          });
          affectedCount++;
        }
      }
    }

    await this.prisma.auditLog.create({
      data: {
        action: `ایجاد برچسب «${tag}»`,
        details: `برچسب «${tag}» با موفقیت ایجاد و به ${affectedCount} محصول متصل شد.`,
        user: dto.user || user,
        type: 'product_toggle',
      },
    });

    if (this.searchService) {
      this.searchService.reindexAll().catch(() => {});
    }

    return { tag, affectedCount };
  }

  /**
   * Rename a tag across all products
   */
  async renameTag(dto: RenameTagDto, user = 'مدیر سیستم') {
    const oldTag = dto.oldTag.trim();
    const newTag = dto.newTag.trim();

    if (!oldTag || !newTag) {
      throw new BadRequestException('نام قدیمی و جدید برچسب الزامی است.');
    }

    const products = await this.prisma.product.findMany({
      where: { tags: { contains: oldTag } },
    });

    let affectedCount = 0;
    for (const p of products) {
      if (!p.tags) continue;
      let tagsList: string[] = [];
      try {
        tagsList = p.tags.startsWith('[') ? JSON.parse(p.tags) : p.tags.split(',').map((t) => t.trim());
      } catch {
        tagsList = p.tags.split(',').map((t) => t.trim());
      }

      if (tagsList.includes(oldTag)) {
        const nextTags = Array.from(new Set(tagsList.map((t) => (t === oldTag ? newTag : t))));
        await this.prisma.product.update({
          where: { id: p.id },
          data: { tags: JSON.stringify(nextTags) },
        });
        affectedCount++;
      }
    }

    await this.prisma.auditLog.create({
      data: {
        action: `تغییر نام برچسب از «${oldTag}» به «${newTag}»`,
        details: `برچسب در ${affectedCount} محصول با موفقیت بروزرسانی شد.`,
        user: dto.user || user,
        type: 'product_toggle',
      },
    });

    if (this.searchService) {
      this.searchService.reindexAll().catch(() => {});
    }

    return { oldTag, newTag, affectedCount };
  }

  /**
   * Delete a tag across all products
   */
  async deleteTag(tag: string, user = 'مدیر سیستم') {
    const target = tag.trim();
    if (!target) throw new BadRequestException('نام برچسب الزامی است.');

    const products = await this.prisma.product.findMany({
      where: { tags: { contains: target } },
    });

    let affectedCount = 0;
    for (const p of products) {
      if (!p.tags) continue;
      let tagsList: string[] = [];
      try {
        tagsList = p.tags.startsWith('[') ? JSON.parse(p.tags) : p.tags.split(',').map((t) => t.trim());
      } catch {
        tagsList = p.tags.split(',').map((t) => t.trim());
      }

      if (tagsList.includes(target)) {
        const nextTags = tagsList.filter((t) => t !== target);
        await this.prisma.product.update({
          where: { id: p.id },
          data: { tags: JSON.stringify(nextTags) },
        });
        affectedCount++;
      }
    }

    await this.prisma.auditLog.create({
      data: {
        action: `حذف برچسب «${target}»`,
        details: `برچسب از ${affectedCount} محصول حذف گردید.`,
        user,
        type: 'product_toggle',
      },
    });

    if (this.searchService) {
      this.searchService.reindexAll().catch(() => {});
    }

    return { tag: target, affectedCount };
  }

  /**
   * Assign or unassign tag to a list of products
   */
  async assignTag(dto: AssignTagDto, user = 'مدیر سیستم') {
    const tag = dto.tag.trim();
    const action = dto.action || 'add';

    if (!tag) throw new BadRequestException('نام برچسب الزامی است.');
    if (!dto.productIds || dto.productIds.length === 0) {
      throw new BadRequestException('شناسه حداقل یک محصول الزامی است.');
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.productIds } },
    });

    let updatedCount = 0;
    for (const p of products) {
      let tagsList: string[] = [];
      if (p.tags) {
        try {
          tagsList = p.tags.startsWith('[') ? JSON.parse(p.tags) : p.tags.split(',').map((t) => t.trim());
        } catch {
          tagsList = p.tags.split(',').map((t) => t.trim());
        }
      }

      let modified = false;
      if (action === 'add') {
        if (!tagsList.includes(tag)) {
          tagsList.push(tag);
          modified = true;
        }
      } else {
        if (tagsList.includes(tag)) {
          tagsList = tagsList.filter((t) => t !== tag);
          modified = true;
        }
      }

      if (modified) {
        await this.prisma.product.update({
          where: { id: p.id },
          data: { tags: JSON.stringify(tagsList) },
        });
        updatedCount++;
      }
    }

    await this.prisma.auditLog.create({
      data: {
        action: action === 'add' ? `افزودن برچسب «${tag}» به محصولات` : `حذف برچسب «${tag}» از محصولات`,
        details: `برچسب «${tag}» برای ${updatedCount} محصول بروزرسانی شد.`,
        user: dto.user || user,
        type: 'product_toggle',
      },
    });

    if (this.searchService) {
      this.searchService.reindexAll().catch(() => {});
    }

    return { tag, action, updatedCount };
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

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('دسته‌بندی یافت نشد.');
    return this.prisma.category.update({
      where: { id },
      data: dto,
    });
  }

  async deleteCategory(id: string) {
    return this.prisma.category.delete({
      where: { id },
    });
  }
}
