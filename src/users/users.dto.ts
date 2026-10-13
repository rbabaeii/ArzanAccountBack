import { IsString, IsOptional, IsEmail, IsBoolean, IsIn, IsNumber, IsInt, Min, MinLength, MaxLength, Matches, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { SanitizeText } from '../common/decorators/sanitize.decorator';
import { IsIranianNationalCode } from '../common/decorators/is-national-code.decorator';

export class CreateUserDto {
  @SanitizeText()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @SanitizeText()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @SanitizeText()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsOptional()
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل باید معتبر باشد.' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(100)
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

  @SanitizeText()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatar?: string;
}

export class UpdateUserRoleDto {
  @IsIn(['SUPER_ADMIN', 'CATALOG_MANAGER', 'FINANCE_ADMIN', 'SUPPORT_ADMIN', 'USER'])
  role: string;

  @SanitizeText()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  adminUser?: string;
}

export class UpdateUserStatusDto {
  @IsIn(['ACTIVE', 'BLOCKED', 'PENDING'])
  status: string;

  @SanitizeText()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  adminUser?: string;
}

export class UpdateProfileDto {
  @SanitizeText()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @ValidateIf((o) => Boolean(o.name && typeof o.name === 'string' && o.name.trim() !== ''))
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @SanitizeText()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @ValidateIf((o) => Boolean(o.email && typeof o.email === 'string' && o.email.trim() !== ''))
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @SanitizeText()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @ValidateIf((o) => Boolean(o.phone && typeof o.phone === 'string' && o.phone.trim() !== ''))
  @IsOptional()
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل باید معتبر باشد.' })
  phone?: string;

  @SanitizeText()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @ValidateIf((o) => Boolean(o.nationalCode && typeof o.nationalCode === 'string' && o.nationalCode.trim() !== ''))
  @IsOptional()
  @IsString()
  @IsIranianNationalCode({ message: 'کد ملی وارد شده نامعتبر است.' })
  nationalCode?: string;

  @SanitizeText()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @ValidateIf((o) => Boolean(o.birthDate && typeof o.birthDate === 'string' && o.birthDate.trim() !== ''))
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])$/, { message: 'تاریخ تولد باید با فرمت YYYY/MM/DD و مقادیر معتبر ماه و روز باشد.' })
  birthDate?: string;

  @SanitizeText()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @ValidateIf((o) => Boolean(o.jobTitle && typeof o.jobTitle === 'string' && o.jobTitle.trim() !== ''))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobTitle?: string;

  @SanitizeText()
  @IsOptional()
  @IsString()
  @MaxLength(255)
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
  @IsInt({ message: 'تعداد امتیاز باید عدد صحیح باشد.' })
  @Min(10, { message: 'حداقل امتیاز برای تبدیل ۱۰ امتیاز است.' })
  points: number;
}

export class CreateWithdrawalDto {
  @IsNumber()
  amountToman: number;

  @SanitizeText()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cardNumber?: string;

  @SanitizeText()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  sheba?: string;

  @SanitizeText()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountOwnerName?: string;

  @SanitizeText()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  userNote?: string;
}

export class ProcessWithdrawalDto {
  @IsString()
  @IsIn(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @SanitizeText()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;

  @SanitizeText()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankTrackingCode?: string;

  @SanitizeText()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankReceiptUrl?: string;

  @SanitizeText()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  adminName?: string;

  @SanitizeText()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  adminId?: string;
}
