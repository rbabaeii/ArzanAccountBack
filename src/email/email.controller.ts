import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EmailService, SmtpConfig } from './email.service';
import { ApiResponse } from '../common/dto/api-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get('settings')
  async getSettings() {
    const settings = await this.emailService.getSettingsForAdmin();
    return ApiResponse.success(settings);
  }

  @Put('settings')
  async updateSettings(
    @Body() body: { config: Partial<SmtpConfig>; user?: string },
    @CurrentUser('name') userName?: string,
  ) {
    const updated = await this.emailService.updateSettings(
      body.config,
      userName || body.user || 'مدیر ارشد',
    );
    return ApiResponse.success(updated, 'تنظیمات سرور ایمیل با موفقیت ذخیره و اعمال شد.');
  }

  @Post('test')
  async sendTest(@Body() body: { to: string; template?: string }) {
    if (!body.to) {
      return ApiResponse.error('وارد کردن آدرس ایمیل گیرنده الزامی است.');
    }
    const result = await this.emailService.sendTestEmail(body.to, body.template || 'test');
    if (!result.success) {
      return ApiResponse.error(result.error || 'ارسال ایمیل ناموفق بود.');
    }
    return ApiResponse.success(result, 'ایمیل تستی با موفقیت ارسال گردید.');
  }

  @Get('stats')
  async getStats() {
    const stats = await this.emailService.getEmailStats();
    return ApiResponse.success(stats);
  }

  @Get('logs')
  async getLogs(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const data = await this.emailService.getEmailLogs({
      status,
      search,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return ApiResponse.success(data);
  }

  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
  @Post('send-order-receipt')
  async sendOrderReceipt(@Body() body: any) {
    if (!body.customerEmail || !body.orderNumber) {
      return ApiResponse.error('اطلاعات سفارش ناقص است.');
    }
    const result = await this.emailService.sendOrderReceipt(body);
    if (!result.success) {
      return ApiResponse.error(result.error || 'ارسال ایمیل سفارش ناموفق بود.');
    }
    return ApiResponse.success(result, 'رسید سفارش با موفقیت به ایمیل خریدار ارسال شد.');
  }

  @Post('send-custom')
  async sendCustomEmail(
    @Body()
    body: {
      recipientEmail: string;
      recipientName?: string;
      subject: string;
      message: string;
      badge?: string;
      buttonText?: string;
      buttonUrl?: string;
      adminSender?: string;
    },
    @CurrentUser('name') userName?: string,
  ) {
    if (!body.recipientEmail || !body.recipientEmail.includes('@')) {
      return ApiResponse.error('آدرس ایمیل گیرنده نامعتبر است.');
    }
    if (!body.subject || !body.subject.trim()) {
      return ApiResponse.error('موضوع ایمیل نمی‌تواند خالی باشد.');
    }
    if (!body.message || !body.message.trim()) {
      return ApiResponse.error('متن ایمیل نمی‌تواند خالی باشد.');
    }

    const result = await this.emailService.sendCustomUserEmail({
      ...body,
      adminSender: userName || body.adminSender || 'مدیر ارشد',
    });
    if (!result.success) {
      return ApiResponse.error(result.error || 'ارسال ایمیل سفارشی با خطا مواجه شد.');
    }
    return ApiResponse.success(result, 'ایمیل سفارشی با موفقیت برای کاربر ارسال شد.');
  }
}
