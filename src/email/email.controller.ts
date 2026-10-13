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
import {
  UpdateEmailSettingsDto,
  SendTestEmailDto,
  SendOrderReceiptDto,
  SendCustomEmailDto,
} from './email.dto';
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
    @Body() body: UpdateEmailSettingsDto,
    @CurrentUser('name') userName?: string,
  ) {
    const updated = await this.emailService.updateSettings(
      body.config as Partial<SmtpConfig>,
      userName || body.user || 'مدیر ارشد',
    );
    return ApiResponse.success(updated, 'تنظیمات سرور ایمیل با موفقیت ذخیره و اعمال شد.');
  }

  @Post('test')
  async sendTest(@Body() body: SendTestEmailDto) {
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
  async sendOrderReceipt(@Body() body: SendOrderReceiptDto) {
    const data = {
      ...body,
      createdAt: body.createdAt || new Date().toISOString(),
      items: Array.isArray(body.items) ? body.items : [],
      totalPriceToman: body.totalPriceToman || 0,
    };
    const result = await this.emailService.sendOrderReceipt(data as any);
    if (!result.success) {
      return ApiResponse.error(result.error || 'ارسال ایمیل سفارش ناموفق بود.');
    }
    return ApiResponse.success(result, 'رسید سفارش با موفقیت به ایمیل خریدار ارسال شد.');
  }

  @Post('send-custom')
  async sendCustomEmail(
    @Body() body: SendCustomEmailDto,
    @CurrentUser('name') userName?: string,
  ) {
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
