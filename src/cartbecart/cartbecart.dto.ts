import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsNotEmpty,
  Min,
  IsBoolean,
} from 'class-validator';

export class InitiateCardPaymentDto {
  @IsNumber()
  @Min(1000)
  amountToman: number;

  @IsString()
  @IsIn(['ORDER', 'WALLET_TOPUP'])
  paymentType: 'ORDER' | 'WALLET_TOPUP';

  @IsString()
  @IsOptional()
  orderNumber?: string;

  @IsString()
  @IsOptional()
  orderId?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsString()
  @IsOptional()
  callbackUrl?: string;
}

export class SubmitManualReceiptDto {
  @IsString()
  @IsOptional()
  paymentToken?: string;

  @IsNumber()
  @Min(1000)
  amountToman: number;

  @IsString()
  @IsOptional()
  @IsIn(['ORDER', 'WALLET_TOPUP'])
  paymentType?: 'ORDER' | 'WALLET_TOPUP';

  @IsString()
  @IsOptional()
  orderNumber?: string;

  @IsString()
  @IsOptional()
  orderId?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsNotEmpty({ message: 'کد پیگیری یا شماره ارجاع بانکی الزامی است.' })
  trackingCode: string;

  @IsString()
  @IsOptional()
  userCardNumber?: string;

  @IsString()
  @IsOptional()
  receiptUrl?: string;

  @IsString()
  @IsOptional()
  depositTime?: string;

  @IsString()
  @IsOptional()
  userNote?: string;
}

export class AdminApprovePaymentDto {
  @IsString()
  @IsOptional()
  adminNote?: string;
}

export class AdminRejectPaymentDto {
  @IsString()
  @IsNotEmpty({ message: 'علت رد پرداخت الزامی است.' })
  reason: string;
}

export class UpdateCartBeCartSettingsDto {
  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsOptional()
  fallbackCardNumber?: string;

  @IsString()
  @IsOptional()
  fallbackCardOwner?: string;

  @IsString()
  @IsOptional()
  fallbackBankName?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
