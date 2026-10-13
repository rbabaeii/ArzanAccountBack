import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IrMarketBalanceResponse,
  IrMarketMeResponse,
  IrMarketProductRaw,
  IrMarketPurchaseRequest,
  IrMarketPurchaseResponse,
} from './irmarket.dto';

@Injectable()
export class IrMarketService {
  private readonly logger = new Logger(IrMarketService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly isMockPurchase: boolean;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('IRMARKET_BASE_URL', 'https://api.irmarket.store');
    this.apiKey = this.configService.get<string>('IRMARKET_API_KEY') || process.env.IRMARKET_API_KEY || '';
    this.isMockPurchase = this.configService.get<string>('MOCK_PURCHASE', 'true') === 'true';

    this.logger.log(`IrMarketService initialized. Mock Purchase Guard: ${this.isMockPurchase ? 'ACTIVE 🔒' : 'INACTIVE ⚠️'}`);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`irMarket API error [${response.status}] at ${endpoint}: ${errorText}`);
        throw new HttpException(
          {
            message: `خطا در ارتباط با وب‌سرویس مرجع irMarket: ${response.statusText}`,
            status: response.status,
            details: errorText,
          },
          response.status,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Network error connecting to irMarket at ${endpoint}:`, error.message);
      throw new HttpException(
        'عدم برقراری ارتباط با سرورهای API مرجع. لطفاً مجدداً تلاش کنید.',
        HttpStatus.GATEWAY_TIMEOUT,
      );
    }
  }

  /**
   * GET /api/buyer/me
   * Fetches account details, discount rates, and profile info
   */
  async getMe(): Promise<IrMarketMeResponse> {
    return this.request<IrMarketMeResponse>('/api/buyer/me');
  }

  /**
   * GET /api/buyer/balance
   * Fetches live USD wallet balance
   */
  async getBalance(): Promise<IrMarketBalanceResponse> {
    return this.request<IrMarketBalanceResponse>('/api/buyer/balance');
  }

  /**
   * GET /api/buyer/products
   * Fetches full catalog of products with buyer custom prices and live stock
   */
  async getProducts(): Promise<IrMarketProductRaw[]> {
    const response = await this.request<any>('/api/buyer/products');
    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.products)) {
      return response.products;
    }
    return [];
  }

  /**
   * GET /api/buyer/products/{id}
   * Fetches single product real-time stock and price from irMarket
   */
  async getProduct(irmarketProductId: number | string): Promise<any> {
    return this.request<any>(`/api/buyer/products/${irmarketProductId}`);
  }

  /**
   * GET /api/buyer/orders/{id}
   * Polls an order status and credentials
   */
  async getOrder(orderId: number | string): Promise<any> {
    return this.request<any>(`/api/buyer/orders/${orderId}`);
  }

  /**
   * POST /api/buyer/purchase
   * Places an order. PROTECTED BY MOCK PURCHASE GUARD!
   */
  async purchaseProduct(dto: IrMarketPurchaseRequest): Promise<IrMarketPurchaseResponse> {
    // 🔒 SAFETY GUARD: If Mock Purchase is enabled, NEVER touch user's real balance
    if (this.isMockPurchase) {
      this.logger.warn(`🛡️ [MOCK PURCHASE GUARD] Intercepted purchase for product #${dto.product_id}. Real API was NOT called.`);
      
      const mockOrderId = Math.floor(10000 + Math.random() * 90000);
      return {
        success: true,
        order_id: mockOrderId,
        status: 'delivered',
        quantity: dto.quantity,
        total_usd: 0.0,
        accounts: [
          `mock-user-${dto.product_id}@arzan.me : SecPass$2026! (اکانت تستی در محیط توسعه)`,
        ],
        refunded: false,
        message: 'سفارش شبیه‌سازی‌شده با موفقیت ثبت و تحویل داده شد (موجودی واقعی کسر نشد).',
      };
    }

    // Live purchase (only in production with explicit override)
    return this.request<IrMarketPurchaseResponse>('/api/buyer/purchase', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }
}
