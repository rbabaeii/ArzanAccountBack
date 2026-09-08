import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiResponse } from '../common/dto/api-response.dto';
import { CreateUserDto, UpdateUserRoleDto, UpdateUserStatusDto, UpdateProfileDto, TopUpWalletDto, ConvertPointsDto } from './users.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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

  @Post(':id/topup-wallet')
  async topUpWallet(
    @Param('id') id: string,
    @Body() dto: TopUpWalletDto,
  ) {
    const updated = await this.usersService.topUpWallet(id, dto.amountToman);
    return ApiResponse.success(updated, 'کیف پول با موفقیت شارژ گردید.');
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
}
