export interface IrMarketProductRaw {
  id: number;
  name: string;
  name_fa?: string;
  description?: string;
  price_usd: number;
  retail_usd: number;
  discount_percent?: number;
  savings_usd?: number;
  effective_discount_percent?: number;
  stock?: number | null;
  in_stock: boolean;
  requires_email: boolean;
  requires_password?: boolean;
  pricing_unit: 'unit' | 'per_1000';
  price_per_1000_usd?: number | null;
  min_qty?: number;
  max_qty?: number;
  requires_link?: boolean;
  requires_comments?: boolean;
  required_inputs?: string[];
  category?: string;
  category_fa?: string;
  category_id?: number;
}

export interface IrMarketMeResponse {
  success: boolean;
  key: string;
  name: string;
  discount_percent: number;
  special_rate_products: number;
  balance_usd: number;
  webhook_url: string | null;
}

export interface IrMarketBalanceResponse {
  success: boolean;
  balance_usd: number;
}

export interface IrMarketPurchaseRequest {
  product_id: number;
  quantity: number;
  idempotency_key: string;
  customer_email?: string;
  link?: string;
  comments?: string;
  extras?: Record<string, any>;
}

export interface IrMarketPurchaseResponse {
  success: boolean;
  order_id: number;
  status: 'delivered' | 'processing' | 'failed' | 'cancelled';
  quantity: number;
  total_usd: number;
  accounts?: string[];
  refunded?: boolean;
  message?: string;
}
