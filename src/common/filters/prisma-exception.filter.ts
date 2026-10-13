import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'خطای پردازش پایگاه‌داده رخ داده است.';
    let errorType = 'DatabaseError';

    switch (exception.code) {
      case 'P2002': {
        status = HttpStatus.CONFLICT;
        errorType = 'Conflict';
        const target = (exception.meta?.target as string[]) || [];
        const targetStr = Array.isArray(target) ? target.join(', ') : String(target);
        if (targetStr.includes('phone')) {
          message = 'این شماره همراه پیش‌تر در سامانه ثبت گردیده است.';
        } else if (targetStr.includes('email')) {
          message = 'این آدرس ایمیل پیش‌تر در سامانه ثبت گردیده است.';
        } else if (targetStr.includes('code')) {
          message = 'این کد پیش‌تر در سامانه ثبت گردیده است.';
        } else if (targetStr.includes('referralCode')) {
          message = 'این کد معرف پیش‌تر اختصاص یافته است.';
        } else {
          message = 'اطلاعات وارد شده تکراری است و در سیستم موجود می‌باشد.';
        }
        break;
      }
      case 'P2003': {
        status = HttpStatus.BAD_REQUEST;
        errorType = 'ForeignKeyConstraintViolation';
        message = 'امکان حذف یا ویرایش این رکورد به دلیل وابستگی به سایر بخش‌های سیستم وجود ندارد.';
        break;
      }
      case 'P2025': {
        status = HttpStatus.NOT_FOUND;
        errorType = 'NotFound';
        message = 'رکورد درخواستی در پایگاه‌داده یافت نشد.';
        break;
      }
      default: {
        status = HttpStatus.BAD_REQUEST;
        errorType = `PrismaError_${exception.code}`;
        message = 'خطایی در اجرای عملیات پایگاه‌داده رخ داد.';
        this.logger.error(`Prisma error ${exception.code}: ${exception.message}`, exception.stack);
        break;
      }
    }

    response.status(status).json({
      success: false,
      error: errorType,
      message,
      statusCode: status,
      timestamp: new Date().toISOString(),
    });
  }
}
