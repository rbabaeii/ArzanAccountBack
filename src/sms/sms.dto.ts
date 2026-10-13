import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsNotEmpty,
  ValidateNested,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SmsConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  patternOtp?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  patternOrderCreated?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  patternOrderCompleted?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  patternOrderRefunded?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  patternWithdrawalApproved?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  patternWalletTopup?: number;
}

export class UpdateSmsSettingsDto {
  @ValidateNested()
  @Type(() => SmsConfigDto)
  @IsNotEmpty({ message: 'تنظیمات پیامک الزامی است.' })
  config: SmsConfigDto;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  user?: string;
}

export class SendTestSmsDto {
  @IsString()
  @IsNotEmpty({ message: 'شماره گیرنده الزامی است.' })
  to: string;

  @IsNumber()
  @Min(1)
  bodyId: number;

  @IsOptional()
  args?: (string | number)[];
}

export class SendCouponSmsDto {
  @IsString()
  @IsNotEmpty({ message: 'شماره موبایل الزامی است.' })
  phone: string;

  @IsString()
  @IsNotEmpty({ message: 'کد تخفیف الزامی است.' })
  code: string;

  @IsNumber()
  @Min(1)
  discountPercent: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerName?: string;
}
