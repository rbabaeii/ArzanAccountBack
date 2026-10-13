import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsNotEmpty,
  IsEmail,
  ValidateNested,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SmtpConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  host?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  user?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  pass?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  fromName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'فرمت ایمیل فرستنده نامعتبر است.' })
  @MaxLength(150)
  fromEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  replyTo?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateEmailSettingsDto {
  @ValidateNested()
  @Type(() => SmtpConfigDto)
  @IsNotEmpty({ message: 'تنظیمات سرور ایمیل الزامی است.' })
  config: SmtpConfigDto;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  user?: string;
}

export class SendTestEmailDto {
  @IsEmail({}, { message: 'آدرس ایمیل گیرنده نامعتبر است.' })
  @IsNotEmpty({ message: 'وارد کردن آدرس ایمیل گیرنده الزامی است.' })
  to: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  template?: string;
}

export class SendOrderReceiptDto {
  @IsEmail({}, { message: 'آدرس ایمیل مشتری نامعتبر است.' })
  @IsNotEmpty({ message: 'ایمیل مشتری الزامی است.' })
  customerEmail: string;

  @IsString()
  @IsNotEmpty({ message: 'شماره سفارش الزامی است.' })
  orderNumber: string;

  @IsOptional()
  @IsString()
  createdAt?: string;

  @IsOptional()
  items?: any;

  @IsOptional()
  @IsNumber()
  totalPriceToman?: number;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  deliveredAccounts?: string[];

  @IsOptional()
  accountCredentials?: any[];

  @IsOptional()
  @IsBoolean()
  isHybridOrder?: boolean;

  @IsOptional()
  @IsNumber()
  instantItemsCount?: number;

  @IsOptional()
  @IsNumber()
  activationItemsCount?: number;

  @IsOptional()
  @IsString()
  pendingNotice?: string;
}

export class SendCustomEmailDto {
  @IsEmail({}, { message: 'آدرس ایمیل گیرنده نامعتبر است.' })
  @IsNotEmpty({ message: 'وارد کردن آدرس ایمیل گیرنده الزامی است.' })
  recipientEmail: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  recipientName?: string;

  @IsString()
  @IsNotEmpty({ message: 'موضوع ایمیل نمی‌تواند خالی باشد.' })
  @MaxLength(200)
  subject: string;

  @IsString()
  @IsNotEmpty({ message: 'متن ایمیل نمی‌تواند خالی باشد.' })
  @MaxLength(5000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  badge?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  buttonText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  buttonUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  adminSender?: string;
}
