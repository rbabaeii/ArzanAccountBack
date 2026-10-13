import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  IsBoolean,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  productTitle?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  customTitle?: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  priceToman?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  priceUsd?: number;

  @IsNumber()
  @IsOptional()
  durationDays?: number;
}

export class AccountCredentialDto {
  @IsNumber()
  index: number;

  @IsString()
  email: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  productTitle?: string;
}

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
  @Min(0)
  totalPriceToman: number;

  @IsNumber()
  @Min(0)
  totalPriceUsd: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'سبد خرید نمی‌تواند خالی باشد.' })
  @ArrayMaxSize(50, { message: 'حداکثر ۵۰ قلم کالا در هر سفارش مجاز است.' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsString()
  @IsOptional()
  paymentGateway?: string;

  @IsString()
  @IsOptional()
  gateway?: string;

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
  @IsString({ each: true })
  deliveredAccounts?: string[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AccountCredentialDto)
  accountCredentials?: AccountCredentialDto[];

  @IsOptional()
  @IsBoolean()
  isHybridOrder?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  instantItemsCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  activationItemsCount?: number;

  @IsString()
  @IsOptional()
  orderNumber?: string;

  @IsString()
  @IsOptional()
  couponCode?: string;
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
  @IsArray()
  @IsString({ each: true })
  deliveredAccounts?: string[];

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
  @Min(0)
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
