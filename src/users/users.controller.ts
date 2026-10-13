import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiResponse } from '../common/dto/api-response.dto';
import {
  CreateUserDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  UpdateProfileDto,
  TopUpWalletDto,
  ConvertPointsDto,
  CreateWithdrawalDto,
  ProcessWithdrawalDto,
} from './users.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SUPPORT_ADMIN')
  @Get()
  async getUsers(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const data = await this.usersService.getUsers({
      role,
      status,
      search,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return ApiResponse.success(data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN')
  @Get('stats')
  async getUserStats() {
    const stats = await this.usersService.getUserStats();
    return ApiResponse.success(stats);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Get('admin-activities')
  async getAdminActivities(
    @Query('adminId') adminId?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: 'asc' | 'desc',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const data = await this.usersService.getAdminActivities({
      adminId,
      type,
      startDate,
      endDate,
      search,
      sort,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return ApiResponse.success(data);
  }

  /**
   * Admin fetches all withdrawal requests (placed before :id to prevent shadowing)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
  @Get('admin/withdrawals-list')
  async getAdminWithdrawals(
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.usersService.getAdminWithdrawals({
      status,
      userId,
      search,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return ApiResponse.success(result);
  }

  /**
   * Admin approves or rejects a withdrawal request
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
  @Post('admin/withdrawals/:id/process')
  async processWithdrawal(
    @Param('id') id: string,
    @Body() dto: ProcessWithdrawalDto,
    @CurrentUser() adminUser: any,
  ) {
    try {
      const result = await this.usersService.processWithdrawal(id, dto, adminUser);
      return ApiResponse.success(
        result,
        dto.action === 'APPROVE' ? 'درخواست تسویه با موفقیت تایید شد.' : 'درخواست تسویه رد شد.',
      );
    } catch (err: any) {
      return ApiResponse.error(err?.message || 'خطا در بررسی درخواست تسویه.');
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Get(':id/activity-summary')
  async getAdminActivitySummary(@Param('id') id: string) {
    const summary = await this.usersService.getAdminActivitySummary(id);
    return ApiResponse.success(summary);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getUserById(@Param('id') id: string, @CurrentUser() user: any) {
    if (user.id !== id && user.role !== 'SUPER_ADMIN' && user.role !== 'SUPPORT_ADMIN') {
      throw new ForbiddenException('دسترسی غیرمجاز به اطلاعات کاربر دیگر.');
    }
    const userData = await this.usersService.getUserById(id);
    return ApiResponse.success(userData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Post()
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser('phone') adminPhone?: string,
  ) {
    const user = await this.usersService.createUser(dto, adminPhone || 'مدیر ارشد');
    return ApiResponse.success(user, 'کاربر با موفقیت ایجاد شد.');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Put(':id/role')
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser('phone') adminPhone?: string,
  ) {
    const updated = await this.usersService.updateUserRole(id, dto, adminPhone || 'مدیر ارشد');
    return ApiResponse.success(updated, 'نقش کاربر با موفقیت تغییر یافت.');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser('phone') adminPhone?: string,
  ) {
    const updated = await this.usersService.updateUserStatus(id, dto, adminPhone || 'مدیر ارشد');
    return ApiResponse.success(
      updated,
      `وضعیت کاربر به ${updated.status === 'ACTIVE' ? 'فعال' : 'مسدود'} تغییر یافت.`,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/profile')
  async updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: any,
  ) {
    if (user.id !== id && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('شما فقط مجاز به ویرایش مشخصات پروفایل خود هستید.');
    }
    const updated = await this.usersService.updateProfile(id, dto, user);
    return ApiResponse.success(updated, 'اطلاعات پروفایل کاربری با موفقیت به‌روزرسانی شد.');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
  @Post(':id/topup')
  @Post(':id/topup-wallet')
  async topUpWallet(
    @Param('id') id: string,
    @Body() dto: TopUpWalletDto,
  ) {
    const updated = await this.usersService.topUpWallet(id, dto.amountToman);
    return ApiResponse.success(updated, 'کیف پول با موفقیت شارژ گردید.');
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/bind-referral')
  async bindReferral(
    @Param('id') id: string,
    @Body('referralCode') referralCode: string,
    @CurrentUser() user: any,
  ) {
    if (user.id !== id && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('دسترسی غیرمجاز.');
    }
    const updated = await this.usersService.bindReferral(id, referralCode);
    return ApiResponse.success(updated, 'کد معرف با موفقیت برای حساب شما ثبت گردید.');
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/convert-points')
  async convertPoints(
    @Param('id') id: string,
    @Body() dto: ConvertPointsDto,
    @CurrentUser() user: any,
  ) {
    if (user.id !== id && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('دسترسی غیرمجاز.');
    }
    const result = await this.usersService.convertPoints(id, dto.points);
    return ApiResponse.success(result, 'امتیاز کلاب با موفقیت به کد تخفیف تبدیل شد.');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Delete(':id')
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() adminUser: any,
  ) {
    const result = await this.usersService.deleteUser(id, adminUser);
    return ApiResponse.success(result, 'کاربر حذف گردید.');
  }

  /**
   * User creates a withdrawal request
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/withdrawals')
  async requestWithdrawal(
    @Param('id') id: string,
    @Body() dto: CreateWithdrawalDto,
    @CurrentUser() user: any,
  ) {
    if (user.id !== id && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('دسترسی غیرمجاز: امکان ثبت درخواست تسویه برای کاربر دیگر وجود ندارد.');
    }
    try {
      const result = await this.usersService.requestWithdrawal(id, dto);
      return ApiResponse.success(result, 'درخواست تسویه با موفقیت ثبت شد، مبلغ از کیف پول قفل گردید و به واحد مالی ارجاع شد.');
    } catch (err: any) {
      return ApiResponse.error(err?.message || 'خطا در ثبت درخواست تسویه.');
    }
  }

  /**
   * User fetches their withdrawal requests
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/withdrawals')
  async getUserWithdrawals(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    if (user.id !== id && user.role !== 'SUPER_ADMIN' && user.role !== 'FINANCE_ADMIN') {
      throw new ForbiddenException('دسترسی غیرمجاز به درخواست‌های تسویه دیگران.');
    }
    const result = await this.usersService.getUserWithdrawals(id);
    return ApiResponse.success(result);
  }

  /**
   * User fetches their referral network and earnings per user
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/referrals')
  async getReferralNetwork(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    if (user.id !== id && user.role !== 'SUPER_ADMIN' && user.role !== 'SUPPORT_ADMIN') {
      throw new ForbiddenException('دسترسی غیرمجاز.');
    }
    const result = await this.usersService.getReferralNetwork(id);
    return ApiResponse.success(result);
  }
}
