import { IsString, IsNotEmpty, IsNumber, Min, Max, IsOptional, IsBoolean } from 'class-validator';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty({ message: 'کد تخفیف الزامی است.' })
  code: string;

  @IsNumber({}, { message: 'درصد تخفیف باید عدد باشد.' })
  @Min(1, { message: 'حداقل درصد تخفیف ۱ درصد است.' })
  @Max(100, { message: 'حداکثر درصد تخفیف ۱۰۰ درصد است.' })
  discountPercent: number;

  @IsOptional()
  @IsNumber({}, { message: 'سقف تخفیف باید عدد باشد.' })
  @Min(0)
  maxDiscountToman?: number;

  @IsOptional()
  @IsNumber({}, { message: 'حداقل مبلغ سفارش باید عدد باشد.' })
  @Min(0)
  minOrderToman?: number;

  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @IsNumber({}, { message: 'حداکثر دفعات استفاده باید عدد باشد.' })
  @Min(1)
  maxUsage?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  allowedUserIds?: any;
}

export class UpdateCouponDto {
  @IsOptional()
  @IsNumber({}, { message: 'درصد تخفیف باید عدد باشد.' })
  @Min(1)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsNumber({}, { message: 'سقف تخفیف باید عدد باشد.' })
  @Min(0)
  maxDiscountToman?: number;

  @IsOptional()
  @IsNumber({}, { message: 'حداقل مبلغ سفارش باید عدد باشد.' })
  @Min(0)
  minOrderToman?: number;

  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @IsNumber({}, { message: 'حداکثر دفعات استفاده باید عدد باشد.' })
  @Min(1)
  maxUsage?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  allowedUserIds?: any;
}
