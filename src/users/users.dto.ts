import { IsString, IsOptional, IsEmail, IsBoolean, IsIn, IsNumber } from 'class-validator';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsIn(['SUPER_ADMIN', 'CATALOG_MANAGER', 'FINANCE_ADMIN', 'SUPPORT_ADMIN', 'USER'])
  role?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'BLOCKED', 'PENDING'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  isTwoFactorEnabled?: boolean;

  @IsOptional()
  @IsString()
  avatar?: string;
}

export class UpdateUserRoleDto {
  @IsIn(['SUPER_ADMIN', 'CATALOG_MANAGER', 'FINANCE_ADMIN', 'SUPPORT_ADMIN', 'USER'])
  role: string;

  @IsOptional()
  @IsString()
  adminUser?: string;
}

export class UpdateUserStatusDto {
  @IsIn(['ACTIVE', 'BLOCKED', 'PENDING'])
  status: string;

  @IsOptional()
  @IsString()
  adminUser?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  nationalCode?: string;

  @IsOptional()
  @IsString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  bankCardsJson?: string;

  @IsOptional()
  @IsString()
  addressesJson?: string;

  @IsOptional()
  @IsBoolean()
  isTwoFactorEnabled?: boolean;
}

export class TopUpWalletDto {
  @IsNumber()
  amountToman: number;
}

export class ConvertPointsDto {
  @IsNumber()
  points: number;
}

export class CreateWithdrawalDto {
  @IsNumber()
  amountToman: number;

  @IsOptional()
  @IsString()
  cardNumber?: string;

  @IsOptional()
  @IsString()
  sheba?: string;

  @IsOptional()
  @IsString()
  accountOwnerName?: string;

  @IsOptional()
  @IsString()
  userNote?: string;
}

export class ProcessWithdrawalDto {
  @IsString()
  @IsIn(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  adminNote?: string;

  @IsOptional()
  @IsString()
  bankTrackingCode?: string;

  @IsOptional()
  @IsString()
  bankReceiptUrl?: string;

  @IsOptional()
  @IsString()
  adminName?: string;

  @IsOptional()
  @IsString()
  adminId?: string;
}


