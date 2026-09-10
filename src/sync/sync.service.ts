import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { IrMarketService } from '../irmarket/irmarket.service';
import { IrMarketProductRaw } from '../irmarket/irmarket.dto';
import { SearchService } from '../search/search.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private isSyncing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly irMarketService: IrMarketService,
    @Optional() private readonly searchService?: SearchService,
  ) {}

  /**
   * Automatic 30-minute sync job for store inventory and prices
   */
  @Cron('0 */30 * * * *')
  async handleCronSync() {
    this.logger.log('⏰ [CRON] Starting automatic 30-minute inventory & price synchronization...');
    try {
      await this.syncCatalog('سیستم خودکار زمان‌بندی‌شده (هر ۳۰ دقیقه)');
    } catch (err: any) {
      this.logger.error(`Cron sync failed: ${err?.message}`);
    }
  }

  /**
   * Main sync routine:
   * 1. Fetches raw products from irMarket API
   * 2. Auto-registers or updates categories
   * 3. Inserts new products with isActive: false (Inactive by default)
   * 4. Updates existing products' cost prices & stock without overriding admin settings
   * 5. Logs audit record
   */
  async syncCatalog(triggeredBy = 'سیستم خودکار') {
    if (this.isSyncing) {
      return {
        success: false,
        message: 'همگام‌سازی دیگری در حال انجام است. لطفاً شکیبا باشید.',
      };
    }

    this.isSyncing = true;
    this.logger.log(`Starting catalog synchronization triggered by: ${triggeredBy}...`);

    try {
      const rawProducts: IrMarketProductRaw[] = await this.irMarketService.getProducts();
      this.logger.log(`Received ${rawProducts.length} products from irMarket.`);

      let createdCount = 0;
      let updatedCount = 0;

      // 1. Group & Cache Categories
      const categoryMap = new Map<string, string>(); // name -> db id
      for (const p of rawProducts) {
        const catName = p.category || 'سایر سرویس‌ها';
        if (!categoryMap.has(catName)) {
          const slug = this.slugify(p.category || 'other');
          const category = await this.prisma.category.upsert({
            where: { slug },
            update: {
              title: catName,
              titleFa: p.category_fa || catName,
            },
            create: {
              externalId: p.category_id,
              slug,
              title: catName,
              titleFa: p.category_fa || catName,
              description: `سرویس‌ها و اشتراک‌های مرتبط با ${p.category_fa || catName}`,
            },
          });
          categoryMap.set(catName, category.id);
        }
      }

      // 2. Process Products in batches
      for (const p of rawProducts) {
        const categoryId = p.category ? categoryMap.get(p.category) : undefined;

        const existing = await this.prisma.product.findUnique({
          where: { externalId: p.id },
        });

        if (!existing) {
          // Newly imported product -> MUST BE INACTIVE BY DEFAULT (isActive: false)
          await this.prisma.product.create({
            data: {
              externalId: p.id,
              name: p.name,
              nameFa: p.name_fa,
              customTitle: p.name_fa || p.name,
              description: p.description,
              costPriceUsd: p.price_usd,
              retailPriceUsd: p.retail_usd,
              pricingUnit: p.pricing_unit || 'unit',
              pricePer1000Usd: p.price_per_1000_usd,
              minQty: p.min_qty || 1,
              maxQty: p.max_qty || 1,
              requiresEmail: p.requires_email || false,
              requiresPassword: p.requires_password || false,
              requiresLink: p.requires_link || false,
              requiresComments: p.requires_comments || false,
              requiredInputs: JSON.stringify(p.required_inputs || []),
              inStock: p.in_stock !== false,
              stockCount: p.stock ?? 100,
              isActive: false, // 🔒 Inactive by default per project specification!
              categoryId,
              rawDetails: JSON.stringify(p),
            },
          });
          createdCount++;
        } else {
          // Existing product -> update price & stock without changing isActive or customTitle
          await this.prisma.product.update({
            where: { id: existing.id },
            data: {
              costPriceUsd: p.price_usd,
              retailPriceUsd: p.retail_usd,
              pricePer1000Usd: p.price_per_1000_usd,
              inStock: p.in_stock !== false,
              stockCount: p.stock ?? existing.stockCount,
              rawDetails: JSON.stringify(p),
            },
          });
          updatedCount++;
        }
      }

      // 3. Update Sync Timestamp & Balance
      const balanceData = await this.irMarketService.getBalance().catch(() => ({ balance_usd: 0 }));
      const nowStr = new Intl.DateTimeFormat('fa-IR', {
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(new Date());

      await this.prisma.systemSetting.upsert({
        where: { key: 'LAST_SYNC_TIME' },
        update: { value: nowStr },
        create: { key: 'LAST_SYNC_TIME', value: nowStr, description: 'زمان آخرین همگام‌سازی موفق' },
      });

      await this.prisma.systemSetting.upsert({
        where: { key: 'WALLET_BALANCE_USD' },
        update: { value: balanceData.balance_usd.toString() },
        create: { key: 'WALLET_BALANCE_USD', value: balanceData.balance_usd.toString(), description: 'موجودی ارزی irMarket' },
      });

      // 4. Record Audit Log
      await this.prisma.auditLog.create({
        data: {
          action: 'همگام‌سازی خودکار کاتالوگ با irMarket',
          details: `بررسی ${rawProducts.length} محصول؛ ${createdCount} محصول جدید (غیرفعال) افزوده شد و ${updatedCount} محصول بروزرسانی گردید.`,
          user: triggeredBy,
          type: 'sync',
        },
      });

      this.logger.log(`Sync completed successfully. Created: ${createdCount}, Updated: ${updatedCount}`);

      // Instantly update ElasticSearch index with new prices and stock
      if (this.searchService) {
        this.logger.log('Triggering full ElasticSearch re-index after catalog sync...');
        await this.searchService.reindexAll();
      }

      return {
        success: true,
        totalFetched: rawProducts.length,
        createdCount,
        updatedCount,
        walletBalanceUsd: balanceData.balance_usd,
        lastSyncTime: nowStr,
        message: `همگام‌سازی با موفقیت انجام شد (${rawProducts.length} محصول بررسی گردید).`,
      };
    } catch (error) {
      this.logger.error('Error during catalog sync:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a single product's live price and stock from irMarket
   */
  async syncSingleProduct(externalId: number, triggeredBy = 'مدیر سیستم') {
    this.logger.log(`Syncing single product #${externalId} from irMarket...`);
    const raw = await this.irMarketService.getProduct(externalId);
    if (!raw) {
      throw new Error(`محصول با شناسه ${externalId} در وب‌سرویس irMarket یافت نشد.`);
    }

    const existing = await this.prisma.product.findUnique({
      where: { externalId },
    });

    if (!existing) {
      throw new Error(`محصول با شناسه ${externalId} در دیتابیس محلی یافت نشد.`);
    }

    const updated = await this.prisma.product.update({
      where: { id: existing.id },
      data: {
        costPriceUsd: raw.price_usd ?? existing.costPriceUsd,
        retailPriceUsd: raw.retail_usd ?? existing.retailPriceUsd,
        pricePer1000Usd: raw.price_per_1000_usd ?? existing.pricePer1000Usd,
        inStock: raw.in_stock !== false,
        stockCount: raw.stock ?? existing.stockCount,
        rawDetails: JSON.stringify(raw),
      },
    });

    if (this.searchService) {
      await this.searchService.reindexAll();
    }

    await this.prisma.auditLog.create({
      data: {
        action: 'همگام‌سازی تکی محصول با irMarket',
        details: `بروزرسانی مشخصات محصول ${existing.customTitle} (#${externalId}): قیمت خرید ${raw.price_usd}$، موجودی ${raw.stock}`,
        user: triggeredBy,
        type: 'sync',
      },
    });

    return {
      success: true,
      product: updated,
      message: `اطلاعات محصول #${externalId} با موفقیت از irMarket بروزرسانی شد.`,
    };
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || `cat-${Date.now()}`;
  }
}
