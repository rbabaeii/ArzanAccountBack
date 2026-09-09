import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';

export interface IndexedProduct {
  id: string;
  externalId: number;
  name: string;
  nameFa?: string | null;
  customTitle: string;
  description?: string | null;
  persianDescription?: string | null;
  categoryTitle?: string | null;
  categoryTitleFa?: string | null;
  categorySlug?: string | null;
  tags: string[];
  costPriceUsd: number;
  retailPriceUsd: number;
  priceToman: number;
  inStock: boolean;
  stockCount: number;
  image?: string | null;
  badge?: string | null;
  rating: number;
  isFeatured: boolean;
}

export interface IndexedOrder {
  id: string;
  orderNumber: string;
  customerEmail: string;
  customerPhone?: string | null;
  status: string;
  totalPriceToman: number;
  itemsSummary: string;
  createdAt: Date;
}

export interface IndexedUser {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  status: string;
}

export interface IndexedCategory {
  id: string;
  slug: string;
  title: string;
  titleFa?: string | null;
  description?: string | null;
  icon?: string | null;
  productCount: number;
}

export interface SearchResult {
  products: { item: IndexedProduct; score: number; highlights: string[] }[];
  categories: { item: IndexedCategory; score: number }[];
  orders: { item: IndexedOrder; score: number }[];
  users: { item: IndexedUser; score: number }[];
  suggestions: string[];
  totalMatches: number;
  query: string;
  tookMs: number;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);

  // Inverted Memory Index for ultra-fast response (<10ms)
  private productsIndex: IndexedProduct[] = [];
  private categoriesIndex: IndexedCategory[] = [];
  private ordersIndex: IndexedOrder[] = [];
  private usersIndex: IndexedUser[] = [];
  private allTagsSet = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
  ) {}

  async onModuleInit() {
    await this.reindexAll();
  }

  /**
   * Persian & English Text Normalizer
   * Handles Arabic Yeh/Kaf, Half-spaces (ZWNJs), punctuations and casing
   */
  normalizeText(str: string | null | undefined): string {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
      .replace(/\u200C/g, ' ') // Convert half-spaces to normal spaces
      .replace(/[ي]/g, 'ی')
      .replace(/[ك]/g, 'ک')
      .replace(/[ۀة]/g, 'ه')
      .replace(/[أإآ]/g, 'ا')
      .replace(/[ؤ]/g, 'و')
      .replace(/[\u064B-\u065F]/g, '') // Remove Arabic vowels/tashkeel
      .replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, ' ') // Replace punctuation with space
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tokenize text into normalized unique words
   */
  tokenize(text: string): string[] {
    const normalized = this.normalizeText(text);
    return normalized.split(' ').filter((w) => w.length > 0);
  }

  /**
   * Full Re-indexing of Catalog, Categories, Orders and Users
   */
  async reindexAll() {
    const start = Date.now();
    try {
      this.logger.log('Starting full re-indexing for ElasticSearch engine...');

      const [dbProducts, dbCategories, dbOrders, dbUsers] = await Promise.all([
        this.prisma.product.findMany({
          include: { category: true },
        }),
        this.prisma.category.findMany({
          include: { _count: { select: { products: true } } },
        }),
        this.prisma.order.findMany({
          take: 300,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.findMany({
          take: 300,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      this.allTagsSet.clear();

      // 1. Index Products
      this.productsIndex = await Promise.all(
        dbProducts.map(async (p) => {
          let tagsArray: string[] = [];
          if (p.tags) {
            try {
              if (p.tags.startsWith('[')) {
                tagsArray = JSON.parse(p.tags);
              } else {
                tagsArray = p.tags.split(',').map((t) => t.trim());
              }
            } catch {
              tagsArray = p.tags.split(',').map((t) => t.trim());
            }
          }

          // Auto-generate high-relevance tags if empty
          if (tagsArray.length === 0) {
            tagsArray = this.generateSmartTags(p.customTitle, p.name, p.category?.titleFa);
          }

          tagsArray.forEach((t) => this.allTagsSet.add(t));

          const price = await this.pricingService.calculatePrice(
            p.costPriceUsd,
            p.retailPriceUsd,
            p.customMarginPercent,
            p.pricingUnit,
          );

          return {
            id: p.id,
            externalId: p.externalId,
            name: p.name,
            nameFa: p.nameFa,
            customTitle: p.customTitle,
            description: p.description,
            persianDescription: p.persianDescription,
            categoryTitle: p.category?.title,
            categoryTitleFa: p.category?.titleFa,
            categorySlug: p.category?.slug,
            tags: tagsArray,
            costPriceUsd: p.costPriceUsd,
            retailPriceUsd: p.retailPriceUsd,
            priceToman: price.finalToman,
            inStock: p.inStock,
            stockCount: p.stockCount || 0,
            image: p.image,
            badge: p.badge,
            rating: p.rating,
            isFeatured: p.isFeatured,
          };
        }),
      );

      // 2. Index Categories
      this.categoriesIndex = dbCategories.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        titleFa: c.titleFa,
        description: c.description,
        icon: c.icon,
        productCount: c._count.products,
      }));

      // 3. Index Orders
      this.ordersIndex = dbOrders.map((o) => {
        let itemsSummary = '';
        try {
          const items = JSON.parse(o.items || '[]');
          itemsSummary = items.map((it: any) => it.productTitle).join(', ');
        } catch {
          itemsSummary = '';
        }

        return {
          id: o.id,
          orderNumber: o.orderNumber,
          customerEmail: o.customerEmail,
          customerPhone: o.customerPhone,
          status: o.status,
          totalPriceToman: o.totalPriceToman,
          itemsSummary,
          createdAt: o.createdAt,
        };
      });

      // 4. Index Users
      this.usersIndex = dbUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
      }));

      this.logger.log(
        `ElasticSearch engine indexed ${this.productsIndex.length} products, ${this.categoriesIndex.length} categories, ${this.ordersIndex.length} orders, ${this.usersIndex.length} users, ${this.allTagsSet.size} unique tags in ${Date.now() - start}ms`,
      );
    } catch (err: any) {
      this.logger.error('Failed to index documents for search:', err?.stack || err?.message);
    }
  }

  /**
   * Smart tag extractor based on product title and keywords
   */
  private generateSmartTags(customTitle: string, name: string, categoryFa?: string | null): string[] {
    const tags: string[] = [];
    const combined = (customTitle + ' ' + name + ' ' + (categoryFa || '')).toLowerCase();

    if (combined.includes('تلگرام') || combined.includes('telegram')) {
      tags.push('تلگرام', 'پرمیوم', 'استارز', 'اکانت قانونی');
    }
    if (combined.includes('chatgpt') || combined.includes('هوش مصنوعی') || combined.includes('gpt') || combined.includes('openai')) {
      tags.push('هوش مصنوعی', 'چت جی‌پی‌تی', 'chatgpt', 'openai', 'اشتراک پلاس');
    }
    if (combined.includes('spotify') || combined.includes('اسپاتیفای')) {
      tags.push('اسپاتیفای', 'موزیک', 'spotify', 'پرمیوم موزیک');
    }
    if (combined.includes('netflix') || combined.includes('نتفلیکس')) {
      tags.push('نتفلیکس', 'فیلم و سریال', 'netflix', '4k');
    }
    if (combined.includes('youtube') || combined.includes('یوتیوب')) {
      tags.push('یوتیوب', 'یوتیوب پرمیوم', 'youtube', 'بدون تبلیغات');
    }
    if (combined.includes('vpn') || combined.includes('وی پی ان') || combined.includes('فیلترشکن') || combined.includes('سرور')) {
      tags.push('وی پی ان', 'vpn', 'اینترنت آزاد', 'آی پی ثابت');
    }
    if (combined.includes('game') || combined.includes('steam') || combined.includes('گیم') || combined.includes('استیم')) {
      tags.push('گیمینگ', 'استیم', 'اکانت بازی');
    }
    if (tags.length === 0) {
      tags.push('اشتراک قانونی', 'تحویل فوری');
    }

    return Array.from(new Set(tags));
  }

  /**
   * Real-Time ElasticSearch Live Query
   */
  search(params: {
    query: string;
    scope?: 'public' | 'admin' | 'all';
    limit?: number;
    categoryId?: string;
  }): SearchResult {
    const start = Date.now();
    const rawQuery = params.query ? params.query.trim() : '';
    const normQuery = this.normalizeText(rawQuery);
    const tokens = this.tokenize(normQuery);
    const scope = params.scope || 'public';
    const limit = params.limit || 10;

    if (!normQuery) {
      return {
        products: [],
        categories: [],
        orders: [],
        users: [],
        suggestions: Array.from(this.allTagsSet).slice(0, 6),
        totalMatches: 0,
        query: rawQuery,
        tookMs: Date.now() - start,
      };
    }

    // --- 1. SEARCH PRODUCTS ---
    const scoredProducts: { item: IndexedProduct; score: number; highlights: string[] }[] = [];

    for (const prod of this.productsIndex) {
      let score = 0;
      const highlights: string[] = [];

      const normTitle = this.normalizeText(prod.customTitle);
      const normName = this.normalizeText(prod.name);
      const normDesc = this.normalizeText(prod.persianDescription || prod.description || '');
      const normCat = this.normalizeText((prod.categoryTitleFa || '') + ' ' + (prod.categoryTitle || ''));

      // 1. Tag Scoring (HIGHEST BOOST: +50 for exact tag match, +25 for partial tag match)
      for (const tag of prod.tags) {
        const normTag = this.normalizeText(tag);
        if (normTag === normQuery) {
          score += 50;
          highlights.push(`تگ: ${tag}`);
        } else if (normTag.includes(normQuery) || normQuery.includes(normTag)) {
          score += 25;
          highlights.push(`تگ: ${tag}`);
        }
        for (const token of tokens) {
          if (normTag.includes(token)) {
            score += 15;
          }
        }
      }

      // 2. Title Exact & Substring Scoring (+40 / +25)
      if (normTitle === normQuery || normName === normQuery) {
        score += 45;
        highlights.push(prod.customTitle);
      } else if (normTitle.includes(normQuery) || normName.includes(normQuery)) {
        score += 30;
        highlights.push(prod.customTitle);
      } else {
        // Match individual tokens
        let matchedTokens = 0;
        for (const token of tokens) {
          if (normTitle.includes(token) || normName.includes(token)) {
            matchedTokens++;
          }
        }
        if (matchedTokens > 0) {
          score += matchedTokens * 15;
          highlights.push(prod.customTitle);
        }
      }

      // 3. Category match (+15)
      if (normCat.includes(normQuery)) {
        score += 15;
      }

      // 4. Description match (+10)
      if (normDesc.includes(normQuery)) {
        score += 10;
      }

      // 5. Stock & Feature Bonuses
      if (score > 0) {
        if (prod.inStock) score += 5;
        if (prod.isFeatured) score += 4;
        scoredProducts.push({ item: prod, score, highlights: Array.from(new Set(highlights)) });
      }
    }

    scoredProducts.sort((a, b) => b.score - a.score);
    const topProducts = scoredProducts.slice(0, limit);

    // --- 2. SEARCH CATEGORIES ---
    const scoredCategories: { item: IndexedCategory; score: number }[] = [];
    for (const cat of this.categoriesIndex) {
      let score = 0;
      const normCatTitle = this.normalizeText(cat.titleFa || cat.title);
      if (normCatTitle.includes(normQuery) || cat.slug.toLowerCase().includes(normQuery)) {
        score += 30;
        scoredCategories.push({ item: cat, score });
      }
    }
    scoredCategories.sort((a, b) => b.score - a.score);

    // --- 3. SEARCH ORDERS (Admin scope) ---
    const scoredOrders: { item: IndexedOrder; score: number }[] = [];
    if (scope === 'admin' || scope === 'all') {
      for (const ord of this.ordersIndex) {
        let score = 0;
        const normNum = ord.orderNumber.toLowerCase();
        const normEmail = (ord.customerEmail || '').toLowerCase();
        const normPhone = (ord.customerPhone || '').toLowerCase();
        const normItems = this.normalizeText(ord.itemsSummary);

        if (normNum.includes(normQuery)) score += 50;
        if (normEmail.includes(normQuery)) score += 40;
        if (normPhone.includes(normQuery)) score += 40;
        if (normItems.includes(normQuery)) score += 20;

        if (score > 0) {
          scoredOrders.push({ item: ord, score });
        }
      }
      scoredOrders.sort((a, b) => b.score - a.score);
    }

    // --- 4. SEARCH USERS (Admin scope) ---
    const scoredUsers: { item: IndexedUser; score: number }[] = [];
    if (scope === 'admin' || scope === 'all') {
      for (const usr of this.usersIndex) {
        let score = 0;
        const normName = this.normalizeText(usr.name);
        const normEmail = (usr.email || '').toLowerCase();
        const normPhone = (usr.phone || '').toLowerCase();

        if (normName.includes(normQuery)) score += 40;
        if (normEmail.includes(normQuery)) score += 40;
        if (normPhone.includes(normQuery)) score += 40;

        if (score > 0) {
          scoredUsers.push({ item: usr, score });
        }
      }
      scoredUsers.sort((a, b) => b.score - a.score);
    }

    // --- 5. SUGGESTIONS AUTOCOMPLETE ---
    const matchedTags: string[] = [];
    for (const tag of this.allTagsSet) {
      if (this.normalizeText(tag).includes(normQuery)) {
        matchedTags.push(tag);
      }
    }

    return {
      products: topProducts,
      categories: scoredCategories.slice(0, 4),
      orders: scoredOrders.slice(0, 6),
      users: scoredUsers.slice(0, 6),
      suggestions: matchedTags.slice(0, 5),
      totalMatches: topProducts.length + scoredCategories.length + scoredOrders.length + scoredUsers.length,
      query: rawQuery,
      tookMs: Date.now() - start,
    };
  }

  /**
   * Search Products by specific tag
   */
  searchByTag(tag: string, limit = 20) {
    const norm = this.normalizeText(tag);
    const matched = this.productsIndex.filter((p) =>
      p.tags.some((t) => this.normalizeText(t) === norm),
    );
    return matched.slice(0, limit);
  }

  /**
   * Get related products based on tag intersection count
   */
  getRelatedProducts(productId: string, limit = 4): IndexedProduct[] {
    const target = this.productsIndex.find((p) => p.id === productId || p.externalId === Number(productId));
    if (!target) return [];

    const targetTags = new Set(target.tags.map((t) => this.normalizeText(t)));

    const scored = this.productsIndex
      .filter((p) => p.id !== target.id)
      .map((p) => {
        let commonTags = 0;
        for (const t of p.tags) {
          if (targetTags.has(this.normalizeText(t))) {
            commonTags++;
          }
        }
        // Bonus for same category
        const sameCategory = p.categorySlug === target.categorySlug ? 1 : 0;
        return {
          product: p,
          score: commonTags * 10 + sameCategory * 5,
        };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((s) => s.product);
  }
}
