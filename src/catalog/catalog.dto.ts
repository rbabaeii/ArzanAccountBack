import { IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  customTitle?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  persianDescription?: string;

  @IsOptional()
  @IsString()
  badge?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsNumber()
  costPriceUsd?: number;

  @IsOptional()
  @IsNumber()
  retailPriceUsd?: number;

  @IsOptional()
  @IsNumber()
  customMarginPercent?: number;

  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @IsNumber()
  stockCount?: number;

  @IsOptional()
  @IsString()
  pricingUnit?: string;

  @IsOptional()
  @IsNumber()
  pricePer1000Usd?: number;

  @IsOptional()
  @IsNumber()
  minQty?: number;

  @IsOptional()
  @IsNumber()
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
  salePriceToman?: number;

  @IsOptional()
  @IsNumber()
  discountPercent?: number;

  @IsOptional()
  tags?: any;

  @IsOptional()
  @IsString()
  user?: string;
}

export class CreateProductDto {
  @IsString()
  customTitle: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsNumber()
  costPriceUsd: number;

  @IsOptional()
  @IsNumber()
  retailPriceUsd?: number;

  @IsOptional()
  @IsNumber()
  customMarginPercent?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
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
  minQty?: number;

  @IsOptional()
  @IsNumber()
  maxQty?: number;

  @IsOptional()
  @IsNumber()
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
  salePriceToman?: number;

  @IsOptional()
  @IsNumber()
  discountPercent?: number;

  @IsOptional()
  tags?: any;

  @IsOptional()
  @IsString()
  user?: string;
}

export class CreateTagDto {
  @IsString()
  tag: string;

  @IsOptional()
  productIds?: string[];

  @IsOptional()
  @IsString()
  user?: string;
}

export class RenameTagDto {
  @IsString()
  oldTag: string;

  @IsString()
  newTag: string;

  @IsOptional()
  @IsString()
  user?: string;
}

export class AssignTagDto {
  @IsString()
  tag: string;

  productIds: string[];

  @IsOptional()
  @IsString()
  action?: 'add' | 'remove';

  @IsOptional()
  @IsString()
  user?: string;
}

export class CreateCategoryDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  titleFa?: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  titleFa?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsNumber()
  orderIndex?: number;
}
