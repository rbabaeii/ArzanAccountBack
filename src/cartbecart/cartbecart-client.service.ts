import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { CARTBECART_BASE_URL } from './cartbecart.constants';
import {
  CartBeCartCreateOrderPayload,
  CartBeCartCreateOrderResponse,
  CartBeCartOrderStatusResponse,
  CartBeCartPayDetailsResponse,
  CartBeCartShopConfigResponse,
} from './cartbecart.types';

@Injectable()
export class CartBeCartClientService {
  private readonly logger = new Logger(CartBeCartClientService.name);
  private readonly baseUrl: string = CARTBECART_BASE_URL;

  /**
   * Fetch current shop configuration, plan, active card status, and quota from CartBeCart API
   */
  async getShopConfig(apiKey: string): Promise<CartBeCartShopConfigResponse | null> {
    if (!apiKey || apiKey.trim().length === 0) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/public/shop-config`, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey.trim(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(`CartBeCart getShopConfig returned status ${response.status}: ${errorText}`);
        return null;
      }

      const data = (await response.json()) as CartBeCartShopConfigResponse;
      return data;
    } catch (err: any) {
      this.logger.error(`Failed to fetch CartBeCart shop-config: ${err?.message}`);
      return null;
    }
  }

  /**
   * Create a real order in CartBeCart to obtain unique_amount and payment_token
   */
  async createOrder(
    apiKey: string,
    payload: CartBeCartCreateOrderPayload,
  ): Promise<CartBeCartCreateOrderResponse> {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new BadRequestException('کلید وب‌سرویس CartBeCart تنظیم نشده است.');
    }

    const cleanApiKey = apiKey.trim();

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/public/orders`, {
        method: 'POST',
        headers: {
          'X-API-Key': cleanApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: payload.amount, // in Rials
          callback_url: payload.callback_url || 'https://arzanaccount.com/payment/cartbecart/callback',
          merchant_order_id: payload.merchant_order_id,
          customer_name: payload.customer_name,
          customer_phone: payload.customer_phone,
        }),
      });

      if (response.status === 401) {
        this.logger.error('Invalid CartBeCart API Key (401 Unauthorized).');
        throw new UnauthorizedException('کلید وب‌سرویس CartBeCart نامعتبر است (401).');
      }

      if (response.status === 403) {
        let detail = 'دسترسی مسدود است';
        try {
          const errData = await response.json();
          detail = errData.detail || detail;
        } catch {}
        this.logger.error(`CartBeCart 403 Forbidden: ${detail}`);
        throw new ForbiddenException(`دسترسی به درگاه CartBeCart مسدود است: ${detail}`);
      }

      if (response.status === 422) {
        let detail = 'درخواست نامعتبر';
        try {
          const errData = await response.json();
          detail = errData.detail || detail;
        } catch {}
        this.logger.error(`CartBeCart 422 Unprocessable: ${detail}`);
        if (detail.includes('کارت پیش‌فرض') || detail.includes('کارت')) {
          throw new BadRequestException(
            'کارت پیش‌فرض فعالی در پنل CartBeCart تنظیم نشده است. لطفاً در داشبورد cartbecart.com کارت بانکی پیش‌فرض خود را اضافه و فعال نمایید.',
          );
        }
        throw new BadRequestException(`درخواست نامعتبر CartBeCart: ${detail}`);
      }

      if (response.status === 429) {
        this.logger.warn('CartBeCart rate limit reached (429).');
        throw new HttpException(
          'تعداد درخواست‌ها به درگاه CartBeCart بیش از حد مجاز است. لطفاً کمی صبر کرده و مجدداً تلاش نمایید.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`CartBeCart create order failed (${response.status}): ${errorText}`);
        throw new BadRequestException(`خطا در ایجاد تراکنش کارت‌به‌کارت (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as CartBeCartCreateOrderResponse;
      if (!data.payment_token && (data as any).token) {
        data.payment_token = (data as any).token;
      }
      if (!data.payment_token && data.payment_url) {
        data.payment_token = data.payment_url.split('/').pop()?.split('?')[0] || '';
      }
      return data;
    } catch (err: any) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`CartBeCart network error: ${err?.message}`);
      throw new BadRequestException(`خطا در اتصال به درگاه CartBeCart: ${err?.message}`);
    }
  }

  /**
   * Check order status via authenticated merchant endpoint
   */
  async getOrderStatus(
    apiKey: string,
    paymentToken: string,
  ): Promise<CartBeCartOrderStatusResponse | null> {
    if (!apiKey || !paymentToken) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/public/orders/${paymentToken}`, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey.trim(),
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 429) {
        this.logger.warn(`Rate limit hit (429) checking order ${paymentToken}`);
        return null;
      }

      if (!response.ok) {
        this.logger.warn(`Failed to fetch CartBeCart status (${response.status}) for ${paymentToken}`);
        return null;
      }

      const data = (await response.json()) as CartBeCartOrderStatusResponse;
      return data;
    } catch (err: any) {
      this.logger.warn(`Error querying CartBeCart order status: ${err?.message}`);
      return null;
    }
  }

  /**
   * Get direct payment page details (Card number, card owner, amount, expires_at)
   * This endpoint does not require an API key and uses payment_token
   */
  async getPayDetails(paymentToken: string): Promise<CartBeCartPayDetailsResponse | null> {
    if (!paymentToken) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/pay/${paymentToken}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as CartBeCartPayDetailsResponse;
      return data;
    } catch (err: any) {
      this.logger.warn(`Error fetching pay details for ${paymentToken}: ${err?.message}`);
      return null;
    }
  }
}

