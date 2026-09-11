import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  customerEmail: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsString()
  @IsOptional()
  customerLink?: string;

  @IsNumber()
  totalPriceToman: number;

  @IsNumber()
  totalPriceUsd: number;

  @IsArray()
  items: any[];

  @IsString()
  @IsOptional()
  paymentGateway?: string;

  @IsString()
  @IsOptional()
  deliveryType?: string; // link, credentials, account_activation

  @IsString()
  @IsOptional()
  targetAccountEmail?: string;

  @IsString()
  @IsOptional()
  targetAccountPassword?: string;

  @IsArray()
  @IsOptional()
  deliveredAccounts?: string[];

  @IsArray()
  @IsOptional()
  accountCredentials?: any[];

  @IsOptional()
  isHybridOrder?: boolean;

  @IsOptional()
  instantItemsCount?: number;

  @IsOptional()
  activationItemsCount?: number;

  @IsString()
  @IsOptional()
  orderNumber?: string;
}

export class UpdateOrderStatusDto {
  @IsString()
  @IsNotEmpty()
  status: string; // processing, delivered, failed, refund_requested, refunded

  @IsString()
  @IsOptional()
  adminId?: string;

  @IsString()
  @IsOptional()
  adminName?: string;

  @IsString()
  @IsOptional()
  adminPhone?: string;

  @IsOptional()
  deliveredAccounts?: any;

  @IsString()
  @IsOptional()
  customerEmail?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ProcessRefundDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsNumber()
  refundAmountToman: number;

  @IsString()
  @IsOptional()
  refundCardNumber?: string;

  @IsString()
  @IsOptional()
  refundIban?: string;

  @IsString()
  @IsOptional()
  refundTrackingCode?: string;

  @IsString()
  @IsOptional()
  refundMethod?: 'bank_card' | 'wallet';

  @IsString()
  @IsOptional()
  refundReceiptUrl?: string;

  @IsString()
  @IsOptional()
  customerEmail?: string;

  @IsString()
  @IsOptional()
  adminId?: string;

  @IsString()
  @IsOptional()
  adminName?: string;
}

export class RejectRefundDto {
  @IsString()
  @IsNotEmpty()
  rejectionReason: string;

  @IsString()
  @IsOptional()
  newStatus?: string;

  @IsString()
  @IsOptional()
  adminId?: string;

  @IsString()
  @IsOptional()
  adminName?: string;
}

export class RequestRefundDto {
  @IsString()
  @IsNotEmpty()
  refundReason: string;

  @IsString()
  @IsOptional()
  refundCardNumber?: string;

  @IsString()
  @IsOptional()
  refundIban?: string;
}
