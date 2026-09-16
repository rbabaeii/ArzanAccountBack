import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Headers,
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
import { JwtService } from '@nestjs/jwt';

@Controller('cartbecart')
export class CartBeCartController {
  private readonly logger = new Logger(CartBeCartController.name);

  constructor(
    private readonly cartBeCartService: CartBeCartService,
    private readonly jwtService: JwtService,
  ) {}

  private extractAdminUser(authHeader?: string, clientUser?: any) {
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload: any = this.jwtService.decode(token);
        if (payload) {
          return {
            id: payload.sub || payload.id,
            name: payload.name || payload.email || 'مدیر سیستم',
            phone: payload.phone,
            role: payload.role || 'USER',
          };
        }
      } catch {
        // token decode error
      }
    }
    return {
      id: clientUser?.id,
      name: clientUser?.name || 'مدیر مالی',
      phone: clientUser?.phone,
      role: clientUser?.role || 'USER',
    };
  }

  private assertAdminRole(role: string) {
    if (
      role !== 'SUPER_ADMIN' &&
      role !== 'FINANCE_ADMIN' &&
      role !== 'ADMIN' &&
      role !== 'SUPPORT_ADMIN'
    ) {
      throw new ForbiddenException('شما دسترسی لازم به این بخش مدیریتی را ندارید.');
    }
  }

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
   * Test / Demo helper: Simulate instant payment verification
   */
  @Post('simulate-success/:token')
  async simulateSuccess(
    @Param('token') token: string,
    @Headers('authorization') authHeader?: string,
    @Query('role') roleFromQuery?: string,
  ) {
    const user = this.extractAdminUser(authHeader, { role: roleFromQuery });
    const data = await this.cartBeCartService.simulatePaymentSuccess(token, user);
    return ApiResponse.success(data, 'تراکنش تستی با موفقیت تأیید شد.');
  }

  /**
   * User: Fetch own card payments / deposits history
   */
  @Get('user/:userId')
  async getUserPayments(
    @Param('userId') userId: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
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
  @Get('admin/payments')
  async getAdminPayments(
    @Headers('authorization') authHeader?: string,
    @Query('role') roleFromQuery?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const admin = this.extractAdminUser(authHeader, { role: roleFromQuery });
    this.assertAdminRole(admin.role);

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
  @Post('admin/approve/:id')
  async approvePayment(
    @Param('id') id: string,
    @Body() dto: AdminApprovePaymentDto,
    @Headers('authorization') authHeader?: string,
    @Body('adminUser') adminUserFromBody?: any,
  ) {
    const admin = this.extractAdminUser(authHeader, adminUserFromBody);
    this.assertAdminRole(admin.role);

    const data = await this.cartBeCartService.adminApprovePayment(id, dto, admin);
    return ApiResponse.success(data, 'پرداخت کاربر با موفقیت تأیید شد و سفارش/کیف‌پول بروزرسانی گردید.');
  }

  /**
   * Admin: Reject a manual card payment
   */
  @Post('admin/reject/:id')
  async rejectPayment(
    @Param('id') id: string,
    @Body() dto: AdminRejectPaymentDto,
    @Headers('authorization') authHeader?: string,
    @Body('adminUser') adminUserFromBody?: any,
  ) {
    const admin = this.extractAdminUser(authHeader, adminUserFromBody);
    this.assertAdminRole(admin.role);

    const data = await this.cartBeCartService.adminRejectPayment(id, dto, admin);
    return ApiResponse.success(data, 'درخواست پرداخت کارت‌به‌کارت رد شد.');
  }

  /**
   * Admin: Get CartBeCart settings
   */
  @Get('admin/settings')
  async getSettings(
    @Headers('authorization') authHeader?: string,
    @Query('role') roleFromQuery?: string,
  ) {
    const admin = this.extractAdminUser(authHeader, { role: roleFromQuery });
    this.assertAdminRole(admin.role);

    const data = await this.cartBeCartService.getSettings();
    return ApiResponse.success(data);
  }

  /**
   * Admin: Update CartBeCart settings
   */
  @Put('admin/settings')
  async updateSettings(
    @Body() dto: UpdateCartBeCartSettingsDto,
    @Headers('authorization') authHeader?: string,
    @Body('role') roleFromBody?: string,
  ) {
    const admin = this.extractAdminUser(authHeader, { role: roleFromBody });
    this.assertAdminRole(admin.role);

    const data = await this.cartBeCartService.updateSettings(dto);
    return ApiResponse.success(data, 'تنظیمات درگاه کارت‌به‌کارت با موفقیت ذخیره شد.');
  }
}
