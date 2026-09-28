import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { CartBeCartService } from './cartbecart.service';
import {
  InitiateCardPaymentDto,
  SubmitManualReceiptDto,
  AdminApprovePaymentDto,
  AdminRejectPaymentDto,
  UpdateCartBeCartSettingsDto,
} from './cartbecart.dto';
import { ApiResponse } from '../common/dto/api-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('cartbecart')
export class CartBeCartController {
  private readonly logger = new Logger(CartBeCartController.name);

  constructor(private readonly cartBeCartService: CartBeCartService) {}

  /**
   * Public: Initiate a card-to-card payment
   */
  @Post('initiate')
  async initiate(@Body() dto: InitiateCardPaymentDto) {
    const data = await this.cartBeCartService.initiatePayment(dto);
    return ApiResponse.success(data, 'اطلاعات درگاه پرداخت کارت‌به‌کارت آماده گردید.');
  }

  /**
   * Public: Poll / check status of a card-to-card payment
   */
  @Get('status/:token')
  async checkStatus(@Param('token') token: string) {
    const data = await this.cartBeCartService.checkPaymentStatus(token);
    return ApiResponse.success(data);
  }

  /**
   * Public: Submit manual bank receipt / tracking code
   */
  @Post('submit-receipt')
  async submitReceipt(@Body() dto: SubmitManualReceiptDto) {
    const data = await this.cartBeCartService.submitManualReceipt(dto);
    return ApiResponse.success(
      data,
      'اطلاعات فیش واریزی با موفقیت ثبت شد و در صف بررسی مدیریت مالی قرار گرفت.',
    );
  }

  /**
   * Admin helper: Simulate payment verification (restricted to Admin & dev/staging)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
  @Post('simulate-success/:token')
  async simulateSuccess(
    @Param('token') token: string,
    @CurrentUser() adminUser: any,
  ) {
    if (
      process.env.ENABLE_PAYMENT_SIMULATION !== 'true' &&
      process.env.NODE_ENV === 'production'
    ) {
      throw new ForbiddenException('شبیه‌سازی پرداخت در محیط عملیاتی غیرفعال است.');
    }
    const admin = {
      id: adminUser.id || adminUser.sub,
      name: adminUser.name || 'مدیر مالی',
      phone: adminUser.phone,
      role: adminUser.role,
    };
    const data = await this.cartBeCartService.simulatePaymentSuccess(token, admin);
    return ApiResponse.success(data, 'تراکنش تستی با موفقیت تأیید شد.');
  }

  /**
   * User: Fetch own card payments / deposits history
   */
  @UseGuards(JwtAuthGuard)
  @Get('user/:userId')
  async getUserPayments(
    @Param('userId') userId: string,
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (user.id !== userId && user.role !== 'SUPER_ADMIN' && user.role !== 'FINANCE_ADMIN') {
      throw new ForbiddenException('دسترسی غیرمجاز به سوابق پرداخت کاربر دیگر.');
    }
    const data = await this.cartBeCartService.getUserPayments(userId, {
      status,
      type,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return ApiResponse.success(data);
  }

  /**
   * Admin: List all card payments
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
  @Get('admin/payments')
  async getAdminPayments(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.cartBeCartService.getAdminPayments({
      status,
      type,
      userId,
      search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return ApiResponse.success(data);
  }

  /**
   * Admin: Approve a manual card payment
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
  @Post('admin/approve/:id')
  async approvePayment(
    @Param('id') id: string,
    @Body() dto: AdminApprovePaymentDto,
    @CurrentUser() adminUser: any,
  ) {
    const admin = {
      id: adminUser.id || adminUser.sub,
      name: adminUser.name || 'مدیر مالی',
      phone: adminUser.phone,
      role: adminUser.role,
    };
    const data = await this.cartBeCartService.adminApprovePayment(id, dto, admin);
    return ApiResponse.success(
      data,
      'پرداخت کاربر با موفقیت تأیید شد و سفارش/کیف‌پول بروزرسانی گردید.',
    );
  }

  /**
   * Admin: Reject a manual card payment
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
  @Post('admin/reject/:id')
  async rejectPayment(
    @Param('id') id: string,
    @Body() dto: AdminRejectPaymentDto,
    @CurrentUser() adminUser: any,
  ) {
    const admin = {
      id: adminUser.id || adminUser.sub,
      name: adminUser.name || 'مدیر مالی',
      phone: adminUser.phone,
      role: adminUser.role,
    };
    const data = await this.cartBeCartService.adminRejectPayment(id, dto, admin);
    return ApiResponse.success(data, 'درخواست پرداخت کارت‌به‌کارت رد شد.');
  }

  /**
   * Admin: Get CartBeCart settings
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
  @Get('admin/settings')
  async getSettings() {
    const data = await this.cartBeCartService.getSettings();
    return ApiResponse.success(data);
  }

  /**
   * Admin: Update CartBeCart settings
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
  @Put('admin/settings')
  async updateSettings(
    @Body() dto: UpdateCartBeCartSettingsDto,
  ) {
    const data = await this.cartBeCartService.updateSettings(dto);
    return ApiResponse.success(data, 'تنظیمات درگاه کارت‌به‌کارت با موفقیت ذخیره شد.');
  }
}
