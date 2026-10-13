import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SmsService } from './sms.service';
import { SmsConfig } from './sms.types';
import { UpdateSmsSettingsDto, SendTestSmsDto, SendCouponSmsDto } from './sms.dto';
import { ApiResponse } from '../common/dto/api-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @Get('settings')
  async getSettings() {
    const settings = await this.smsService.getSettingsForAdmin();
    return ApiResponse.success(settings);
  }

  @Put('settings')
  async updateSettings(
    @Body() body: UpdateSmsSettingsDto,
    @CurrentUser('name') userName?: string,
  ) {
    const updated = await this.smsService.updateSettings(
      body.config as Partial<SmsConfig>,
      userName || body.user || 'مدیر ارشد',
    );
    return ApiResponse.success(updated, 'تنظیمات وب‌سرویس پیامک با موفقیت ذخیره شد.');
  }

  @Post('test')
  async sendTest(@Body() body: SendTestSmsDto) {
    const result = await this.smsService.sendTestSms(body.to, Number(body.bodyId), body.args || []);
    if (!result.success) {
      return ApiResponse.error(result.errorMessage || 'ارسال پیامک آزمایشی با خطا مواجه شد.');
    }
    return ApiResponse.success(result, `پیامک تستی با شناسه پیگیری ${result.recId || ''} با موفقیت ارسال گردید.`);
  }

  @Post('send-coupon')
  async sendCoupon(@Body() body: SendCouponSmsDto) {
    const result = await this.smsService.sendCouponSms(
      body.phone,
      body.code,
      body.discountPercent,
      body.customerName,
    );
    return ApiResponse.success(result, 'پیامک اطلاع‌رسانی کد تخفیف با موفقیت ارسال شد.');
  }

  @Get('stats')
  async getStats() {
    const stats = await this.smsService.getSmsStats();
    return ApiResponse.success(stats);
  }

  @Get('logs')
  async getLogs(
    @Query('status') status?: string,
    @Query('template') template?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const data = await this.smsService.getSmsLogs({
      status,
      template,
      search,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return ApiResponse.success(data);
  }
}
