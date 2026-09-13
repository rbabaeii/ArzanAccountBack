/**
 * CartBeCart API Types and Interfaces
 * Upstream Reference: https://www.cartbecart.com/dashboard/docs
 */

export interface CartBeCartCreateOrderPayload {
  amount: number; // in Rials (required)
  callback_url: string; // required by upstream CartBeCart API
  merchant_order_id: string; // unique order code / reference
  customer_name?: string;
  customer_phone?: string;
}

export interface CartBeCartCreateOrderResponse {
  order_id: string;
  order_code: string;
  payment_token: string;
  payment_url: string;
  unique_amount: number; // in Rials
  expires_at: string;
  grace_ends_at?: string;
}

export type CartBeCartRemoteStatus = 'pending' | 'paid' | 'expired' | 'needs_review';

export interface CartBeCartOrderStatusResponse {
  order_id: string;
  order_code: string;
  status: CartBeCartRemoteStatus;
  base_amount: number;
  unique_amount: number;
  merchant_order_id: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  paid_at?: string | null;
  expires_at?: string;
  grace_ends_at?: string;
}

export interface CartBeCartPayDetailsResponse {
  order_code: string;
  unique_amount: number;
  card_number: string;
  card_owner: string;
  shop_support_contact?: string;
  collect_customer_info?: boolean;
  customer_name?: string | null;
  customer_phone?: string | null;
  status: CartBeCartRemoteStatus;
  expires_at?: string;
}

export type LocalPaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'EXPIRED'
  | 'MANUAL_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

export type PaymentType = 'ORDER' | 'WALLET_TOPUP';
