import { IsNotEmpty, IsString, Matches, IsOptional, MinLength, MaxLength, IsEmail } from 'class-validator';
import { SanitizeText } from '../common/decorators/sanitize.decorator';

export class SendOtpDto {
  @SanitizeText()
  @IsString({ message: 'شماره موبایل باید رشته باشد.' })
  @IsNotEmpty({ message: 'شماره موبایل الزامی است.' })
  @Matches(/^09\d{9}$/, {
    message: 'شماره موبایل باید با ۰۹ شروع شده و دارای ۱۱ رقم باشد (مانند 09180000000).',
  })
  phone: string;
}

export class SendEmailOtpDto {
  @SanitizeText()
  @IsString({ message: 'شماره موبایل باید رشته باشد.' })
  @IsNotEmpty({ message: 'شماره موبایل الزامی است.' })
  @Matches(/^09\d{9}$/, {
    message: 'شماره موبایل باید معتبر باشد.',
  })
  phone: string;
}

export class SendDirectEmailOtpDto {
  @SanitizeText()
  @IsEmail({}, { message: 'ایمیل نامعتبر است.' })
  @IsNotEmpty({ message: 'ایمیل نمی‌تواند خالی باشد.' })
  email: string;
}

export class VerifyOtpDto {
  @SanitizeText()
  @IsString({ message: 'شماره موبایل باید رشته باشد.' })
  @IsNotEmpty({ message: 'شماره موبایل الزامی است.' })
  @Matches(/^09\d{9}$/, {
    message: 'شماره موبایل باید معتبر باشد.',
  })
  phone: string;

  @SanitizeText()
  @IsString({ message: 'کد تایید باید رشته باشد.' })
  @IsNotEmpty({ message: 'کد تایید الزامی است.' })
  @MinLength(4, { message: 'کد تایید باید حداقل 4 کاراکتر باشد.' })
  @MaxLength(6, { message: 'کد تایید نمی‌تواند بیش از 6 کاراکتر باشد.' })
  code: string;

  @IsOptional()
  @SanitizeText()
  @IsString()
  @MaxLength(50)
  referralCode?: string;
}

export class VerifyEmailOtpDto {
  @SanitizeText()
  @IsEmail({}, { message: 'ایمیل نامعتبر است.' })
  @IsNotEmpty({ message: 'ایمیل نمی‌تواند خالی باشد.' })
  email: string;

  @SanitizeText()
  @IsString({ message: 'کد تایید الزامی است.' })
  @IsNotEmpty({ message: 'کد تایید الزامی است.' })
  @MinLength(4)
  @MaxLength(6)
  code: string;

  @IsOptional()
  @SanitizeText()
  @IsString()
  @MaxLength(50)
  referralCode?: string;
}

export class LoginPasswordDto {
  @SanitizeText()
  @IsString({ message: 'شماره موبایل باید رشته باشد.' })
  @IsNotEmpty({ message: 'شماره موبایل الزامی است.' })
  @Matches(/^09\d{9}$/, {
    message: 'شماره موبایل باید معتبر باشد.',
  })
  phone: string;

  @IsString({ message: 'رمز عبور باید رشته باشد.' })
  @IsNotEmpty({ message: 'رمز عبور الزامی است.' })
  @MinLength(6, { message: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' })
  @MaxLength(100)
  password: string;

  @IsOptional()
  @SanitizeText()
  @IsString()
  @MaxLength(50)
  referralCode?: string;
}

export class UpdatePasswordDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  currentPassword?: string;

  @IsString({ message: 'رمز عبور جدید الزامی است.' })
  @IsNotEmpty({ message: 'رمز عبور جدید نمی‌تواند خالی باشد.' })
  @MinLength(6, { message: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' })
  @MaxLength(100)
  newPassword: string;
}
