import { IsOptional, IsString, IsNumber, IsBoolean, IsArray, MaxLength, Min, Max, IsIn, IsNotEmpty } from 'class-validator';
import { SanitizeHtml } from '../common/decorators/sanitize-html.decorator';
import { SanitizeText } from '../common/decorators/sanitize.decorator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @SanitizeText()
  customTitle?: string;

  @IsOptional()
  @IsString()
  @SanitizeHtml()
  description?: string;

  @IsOptional()
  @IsString()
  @SanitizeHtml()
  persianDescription?: string;

  @IsOptional()
  @IsString()
  badge?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPriceUsd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  retailPriceUsd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  customMarginPercent?: number;

  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockCount?: number;

  @IsOptional()
  @IsString()
  pricingUnit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePer1000Usd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minQty?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxQty?: number;

  @IsOptional()
  @IsBoolean()
  requiresEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresPassword?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresLink?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresComments?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isFlashDeal?: boolean;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salePriceToman?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  user?: string;
}

export class CreateProductDto {
  @IsNotEmpty()
  @IsString()
  @SanitizeText()
  customTitle: string;

  @IsOptional()
  @IsString()
  @SanitizeText()
  name?: string;

  @IsNumber()
  @Min(0)
  costPriceUsd: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  retailPriceUsd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  customMarginPercent?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @SanitizeHtml()
  description?: string;

  @IsOptional()
  @IsString()
  @SanitizeHtml()
  persianDescription?: string;

  @IsOptional()
  @IsString()
  badge?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  pricingUnit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minQty?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxQty?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockCount?: number;

  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isFlashDeal?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresPassword?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresLink?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresComments?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salePriceToman?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  user?: string;
}

export class CreateTagDto {
  @IsNotEmpty()
  @IsString()
  @SanitizeText()
  tag: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @IsOptional()
  @IsString()
  user?: string;
}

export class RenameTagDto {
  @IsNotEmpty()
  @IsString()
  @SanitizeText()
  oldTag: string;

  @IsNotEmpty()
  @IsString()
  @SanitizeText()
  newTag: string;

  @IsOptional()
  @IsString()
  user?: string;
}

export class AssignTagDto {
  @IsNotEmpty()
  @IsString()
  @SanitizeText()
  tag: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  productIds: string[];

  @IsOptional()
  @IsString()
  @IsIn(['add', 'remove'])
  action?: 'add' | 'remove';

  @IsOptional()
  @IsString()
  user?: string;
}

export class CreateCategoryDto {
  @IsNotEmpty()
  @IsString()
  @SanitizeText()
  title: string;

  @IsOptional()
  @IsString()
  @SanitizeText()
  titleFa?: string;

  @IsNotEmpty()
  @IsString()
  @SanitizeText()
  slug: string;

  @IsOptional()
  @IsString()
  @SanitizeHtml()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @SanitizeText()
  title?: string;

  @IsOptional()
  @IsString()
  @SanitizeText()
  titleFa?: string;

  @IsOptional()
  @IsString()
  @SanitizeText()
  slug?: string;

  @IsOptional()
  @IsString()
  @SanitizeHtml()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  orderIndex?: number;
}
