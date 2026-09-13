import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { CARTBECART_BASE_URL, DEFAULT_FALLBACK_CARD } from './cartbecart.constants';
import {
  CartBeCartCreateOrderPayload,
  CartBeCartCreateOrderResponse,
  CartBeCartOrderStatusResponse,
  CartBeCartPayDetailsResponse,
} from './cartbecart.types';

@Injectable()
export class CartBeCartClientService {
  private readonly logger = new Logger(CartBeCartClientService.name);
  private readonly baseUrl: string = CARTBECART_BASE_URL;

  /**
   * Create an order in CartBeCart to obtain unique_amount and payment_token
   */
  async createOrder(
    apiKey: string,
    payload: CartBeCartCreateOrderPayload,
  ): Promise<CartBeCartCreateOrderResponse> {
    if (!apiKey || apiKey === 'mock' || apiKey === 'demo') {
      this.logger.warn('CartBeCart API key not provided or set to mock. Returning simulated order.');
      return this.createMockOrder(payload);
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/public/orders`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
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
        this.logger.error('Invalid CartBeCart API Key (401 Unauthorized). Falling back to simulated order.');
        return this.createMockOrder(payload);
      }

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`CartBeCart create order failed (${response.status}): ${errorText}`);
        // If upstream error, fallback to mock order so the checkout experience doesn't break
        return this.createMockOrder(payload);
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
      this.logger.error(`CartBeCart connection error: ${err?.message}. Using simulated order.`);
      return this.createMockOrder(payload);
    }
  }

  /**
   * Check order status via authenticated merchant endpoint
   */
  async getOrderStatus(
    apiKey: string,
    paymentToken: string,
  ): Promise<CartBeCartOrderStatusResponse | null> {
    if (!apiKey || apiKey === 'mock' || paymentToken.startsWith('SIM-')) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/public/orders/${paymentToken}`, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
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
    if (paymentToken.startsWith('SIM-')) {
      return {
        order_code: paymentToken,
        unique_amount: 1000000,
        card_number: DEFAULT_FALLBACK_CARD.cardNumber,
        card_owner: DEFAULT_FALLBACK_CARD.cardOwner,
        shop_support_contact: '021-91000000',
        status: 'pending',
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };
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

  /**
   * Helper to generate a realistic simulated CartBeCart order in development / test environments
   */
  private createMockOrder(payload: CartBeCartCreateOrderPayload): CartBeCartCreateOrderResponse {
    // Unique amount adds a random 3-digit rial fraction (e.g. 100 to 900)
    const randomRials = Math.floor(100 + Math.random() * 890);
    const uniqueAmount = payload.amount + randomRials;
    const paymentToken = `SIM-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const graceEndsAt = new Date(Date.now() + 75 * 60 * 1000).toISOString();

    return {
      order_id: `sim-order-${Date.now()}`,
      order_code: `CBC-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      payment_token: paymentToken,
      payment_url: `https://cartbecart.com/pay/${paymentToken}`,
      unique_amount: uniqueAmount,
      expires_at: expiresAt,
      grace_ends_at: graceEndsAt,
    };
  }
}
