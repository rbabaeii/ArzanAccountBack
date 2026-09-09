import { IsNotEmpty, IsString, Matches, IsOptional } from 'class-validator';

export class SendOtpDto {
  @IsString({ message: 'شماره موبایل باید رشته باشد.' })
  @IsNotEmpty({ message: 'شماره موبایل الزامی است.' })
  @Matches(/^09\d{9}$/, {
    message: 'شماره موبایل باید با ۰۹ شروع شده و دارای ۱۱ رقم باشد (مانند 09180000000).',
  })
  phone: string;
}

export class SendEmailOtpDto {
  @IsString({ message: 'شماره موبایل باید رشته باشد.' })
  @IsNotEmpty({ message: 'شماره موبایل الزامی است.' })
  @Matches(/^09\d{9}$/, {
    message: 'شماره موبایل باید معتبر باشد.',
  })
  phone: string;
}

export class VerifyOtpDto {
  @IsString({ message: 'شماره موبایل باید رشته باشد.' })
  @IsNotEmpty({ message: 'شماره موبایل الزامی است.' })
  @Matches(/^09\d{9}$/, {
    message: 'شماره موبایل باید معتبر باشد.',
  })
  phone: string;

  @IsString({ message: 'کد تایید باید رشته باشد.' })
  @IsNotEmpty({ message: 'کد تایید الزامی است.' })
  code: string;
}

export class LoginPasswordDto {
  @IsString({ message: 'شماره موبایل باید رشته باشد.' })
  @IsNotEmpty({ message: 'شماره موبایل الزامی است.' })
  @Matches(/^09\d{9}$/, {
    message: 'شماره موبایل باید معتبر باشد.',
  })
  phone: string;

  @IsString({ message: 'رمز عبور باید رشته باشد.' })
  @IsNotEmpty({ message: 'رمز عبور الزامی است.' })
  password: string;
}

export class UpdatePasswordDto {
  @IsString()
  @IsOptional()
  currentPassword?: string;

  @IsString({ message: 'رمز عبور جدید الزامی است.' })
  @IsNotEmpty({ message: 'رمز عبور جدید نمی‌تواند خالی باشد.' })
  newPassword: string;
}
