import { IsOptional, IsNumber, IsString, IsBoolean, Min, Max } from 'class-validator';
import { SanitizeText } from '../common/decorators/sanitize.decorator';
import { SanitizeHtml } from '../common/decorators/sanitize-html.decorator';

export class UpdateCurrencyDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  usdToRialRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultMarginPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  margin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPurchaseRatioDenominator?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  purchaseRatioExemptionThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  orderCashbackPercent?: number;

  @IsOptional()
  @IsString()
  user?: string;
}

export class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  siteLogo?: string;

  @IsOptional()
  @IsString()
  siteLogoDark?: string;

  @IsOptional()
  @IsString()
  siteFavicon?: string;

  @IsOptional()
  @IsString()
  @SanitizeText()
  siteName?: string;

  @IsOptional()
  @IsString()
  @SanitizeText()
  siteTagline?: string;

  @IsOptional()
  @IsString()
  @SanitizeHtml()
  siteDescription?: string;

  @IsOptional()
  @IsString()
  @SanitizeText()
  sitePhone?: string;

  @IsOptional()
  @IsString()
  @SanitizeText()
  siteEmail?: string;

  @IsOptional()
  @IsString()
  @SanitizeText()
  supportTelegram?: string;

  @IsOptional()
  @IsString()
  @SanitizeText()
  siteInstagram?: string;

  @IsOptional()
  @IsString()
  @SanitizeHtml()
  siteEnamad?: string;

  @IsOptional()
  @IsString()
  user?: string;
}

export class SyncCurrencyNowDto {
  @IsOptional()
  @IsString()
  user?: string;
}

export class UpdateCurrencySyncConfigDto {
  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  intervalMinutes?: number;

  @IsOptional()
  @IsBoolean()
  enableAutoSync?: boolean;

  @IsOptional()
  @IsString()
  user?: string;
}
