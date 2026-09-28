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
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  ProcessRefundDto,
  RequestRefundDto,
  RejectRefundDto,
} from './orders.dto';
import { ApiResponse } from '../common/dto/api-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getOrders(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('customerEmail') customerEmail?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const isAdmin = ['SUPER_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN', 'ADMIN'].includes(user.role);
    let filterEmail = customerEmail;
    let filterPhone: string | undefined;

    if (!isAdmin) {
      // Normal users are forced to view only their own orders
      filterEmail = user.email || undefined;
      filterPhone = user.phone || undefined;
    }

    const data = await this.ordersService.getOrders({
      status,
      customerEmail: filterEmail,
      customerPhone: filterPhone,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return ApiResponse.success(data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN', 'ADMIN')
  @Get('refund-requests')
  async getRefundRequests() {
    const data = await this.ordersService.getRefundRequests();
    return ApiResponse.success(data);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getOrder(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.ordersService.getOrderById(id);
    const isAdmin = ['SUPER_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN', 'ADMIN'].includes(user.role);
    const isOwner =
      (user.email && data.customerEmail && user.email.toLowerCase() === data.customerEmail.toLowerCase()) ||
      (user.phone && data.customerPhone && user.phone === data.customerPhone);

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('دسترسی غیرمجاز به اطلاعات سفارش کاربر دیگر.');
    }
    return ApiResponse.success(data);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createOrder(@Body() dto: CreateOrderDto, @CurrentUser() user: any) {
    const order = await this.ordersService.createOrder(dto, user);
    return ApiResponse.success(order, 'سفارش با موفقیت ثبت شد.');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SUPPORT_ADMIN', 'CATALOG_MANAGER', 'FINANCE_ADMIN')
  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser('phone') adminPhone?: string,
  ) {
    const updated = await this.ordersService.updateStatus(id, dto, adminPhone || 'مدیر سیستم');
    return ApiResponse.success(updated, 'وضعیت سفارش با موفقیت تغییر یافت.');
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/request-refund')
  async requestRefund(
    @Param('id') id: string,
    @Body() dto: RequestRefundDto,
    @CurrentUser() user: any,
  ) {
    const updated = await this.ordersService.requestRefund(id, dto, user);
    return ApiResponse.success(updated, 'درخواست عودت وجه با موفقیت ثبت گردید و در صف بررسی مالی قرار گرفت.');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
  @Post('process-refund')
  async processRefund(@Body() dto: ProcessRefundDto) {
    const updated = await this.ordersService.processRefund(dto);
    return ApiResponse.success(updated, 'تسویه عودت وجه با موفقیت انجام شد و رسید به ایمیل مشتری ارسال گردید.');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN', 'ADMIN')
  @Post(':id/reject-refund')
  async rejectRefund(@Param('id') id: string, @Body() dto: RejectRefundDto) {
    const updated = await this.ordersService.rejectRefund(id, dto);
    return ApiResponse.success(updated, 'مخالفت با درخواست عودت وجه ثبت شد و وضعیت سفارش بازگردانده شد.');
  }
}
