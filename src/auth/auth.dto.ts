import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @IsString({ message: 'شماره موبایل باید رشته باشد.' })
  @IsNotEmpty({ message: 'شماره موبایل الزامی است.' })
  @Matches(/^09\d{9}$/, {
    message: 'شماره موبایل باید با ۰۹ شروع شده و دارای ۱۱ رقم باشد (مانند 09180000000).',
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
