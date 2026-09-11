import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiResponse } from '../common/dto/api-response.dto';
import { CreateUserDto, UpdateUserRoleDto, UpdateUserStatusDto, UpdateProfileDto, TopUpWalletDto, ConvertPointsDto, CreateWithdrawalDto, ProcessWithdrawalDto } from './users.dto';
import { JwtService } from '@nestjs/jwt';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  private extractUserRole(authHeader?: string, roleFromClient?: string): string {
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload: any = this.jwtService.decode(token);
        if (payload?.role) return payload.role;
      } catch {
        // Fallback
      }
    }
    return roleFromClient || 'USER';
  }

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

  @Get('stats')
  async getUserStats() {
    const stats = await this.usersService.getUserStats();
    return ApiResponse.success(stats);
  }

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
  @Get('admin/withdrawals-list')
  async getAdminWithdrawals(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Headers('authorization') authHeader?: string,
    @Query('role') roleFromQuery?: string,
  ) {
    const role = this.extractUserRole(authHeader, roleFromQuery);
    if (role !== 'SUPER_ADMIN' && role !== 'FINANCE_ADMIN' && role !== 'ADMIN') {
      throw new ForbiddenException('شما دسترسی لازم به بخش تسویه حساب مالی را ندارید.');
    }
    const result = await this.usersService.getAdminWithdrawals({
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return ApiResponse.success(result);
  }

  /**
   * Admin approves or rejects a withdrawal request
   */
  @Post('admin/withdrawals/:id/process')
  async processWithdrawal(
    @Param('id') id: string,
    @Body() dto: ProcessWithdrawalDto,
    @Headers('authorization') authHeader?: string,
    @Body('role') roleFromBody?: string,
  ) {
    const role = this.extractUserRole(authHeader, roleFromBody);
    if (role !== 'SUPER_ADMIN' && role !== 'FINANCE_ADMIN' && role !== 'ADMIN') {
      throw new ForbiddenException('شما دسترسی لازم جهت پردازش درخواست‌های تسویه حساب را ندارید.');
    }
    try {
      const result = await this.usersService.processWithdrawal(id, dto);
      return ApiResponse.success(
        result,
        dto.action === 'APPROVE' ? 'درخواست تسویه با موفقیت تایید شد.' : 'درخواست تسویه رد شد.',
      );
    } catch (err: any) {
      return ApiResponse.error(err?.message || 'خطا در بررسی درخواست تسویه.');
    }
  }

  @Get(':id/activity-summary')
  async getAdminActivitySummary(@Param('id') id: string) {
    const summary = await this.usersService.getAdminActivitySummary(id);
    return ApiResponse.success(summary);
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    const user = await this.usersService.getUserById(id);
    return ApiResponse.success(user);
  }

  @Post()
  async createUser(
    @Body() dto: CreateUserDto,
    @Body('adminUser') adminUser?: string,
  ) {
    const user = await this.usersService.createUser(dto, adminUser);
    return ApiResponse.success(user, 'کاربر با موفقیت ایجاد شد.');
  }

  @Put(':id/role')
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @Body('adminUser') adminUser?: string,
  ) {
    const updated = await this.usersService.updateUserRole(id, dto, adminUser);
    return ApiResponse.success(updated, 'نقش کاربر با موفقیت تغییر یافت.');
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @Body('adminUser') adminUser?: string,
  ) {
    const updated = await this.usersService.updateUserStatus(id, dto, adminUser);
    return ApiResponse.success(
      updated,
      `وضعیت کاربر به ${updated.status === 'ACTIVE' ? 'فعال' : 'مسدود'} تغییر یافت.`,
    );
  }

  @Put(':id/profile')
  async updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.usersService.updateProfile(id, dto);
    return ApiResponse.success(updated, 'اطلاعات پروفایل کاربری با موفقیت به‌روزرسانی شد.');
  }

  @Post(':id/topup')
  @Post(':id/topup-wallet')
  async topUpWallet(
    @Param('id') id: string,
    @Body() dto: TopUpWalletDto,
  ) {
    const updated = await this.usersService.topUpWallet(id, dto.amountToman);
    return ApiResponse.success(updated, 'کیف پول با موفقیت شارژ گردید.');
  }

  @Post(':id/bind-referral')
  async bindReferral(
    @Param('id') id: string,
    @Body('referralCode') referralCode: string,
  ) {
    const user = await this.usersService.bindReferral(id, referralCode);
    return ApiResponse.success(user, 'کد معرف با موفقیت برای حساب شما ثبت گردید.');
  }

  @Post(':id/convert-points')
  async convertPoints(
    @Param('id') id: string,
    @Body() dto: ConvertPointsDto,
  ) {
    const result = await this.usersService.convertPoints(id, dto.points);
    return ApiResponse.success(result, 'امتیاز کلاب با موفقیت به کد تخفیف تبدیل شد.');
  }

  @Delete(':id')
  async deleteUser(
    @Param('id') id: string,
    @Body('adminUser') adminUser?: string,
  ) {
    const result = await this.usersService.deleteUser(id, adminUser);
    return ApiResponse.success(result, 'کاربر حذف گردید.');
  }

  /**
   * User creates a withdrawal request
   */
  @Post(':id/withdrawals')
  async requestWithdrawal(
    @Param('id') id: string,
    @Body() dto: CreateWithdrawalDto,
  ) {
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
  @Get(':id/withdrawals')
  async getUserWithdrawals(@Param('id') id: string) {
    const result = await this.usersService.getUserWithdrawals(id);
    return ApiResponse.success(result);
  }

  /**
   * User fetches their referral network and earnings per user
   */
  @Get(':id/referrals')
  async getReferralNetwork(@Param('id') id: string) {
    const result = await this.usersService.getReferralNetwork(id);
    return ApiResponse.success(result);
  }
}
