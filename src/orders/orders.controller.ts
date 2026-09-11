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
  UnauthorizedException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto, ProcessRefundDto, RequestRefundDto } from './orders.dto';
import { ApiResponse } from '../common/dto/api-response.dto';
import { JwtService } from '@nestjs/jwt';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly jwtService: JwtService,
  ) {}

  private extractUserRole(authHeader?: string, roleFromClient?: string): string {
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload: any = this.jwtService.decode(token);
        if (payload?.role) return payload.role;
      } catch {
        // Fallback to client role if token decode fails
      }
    }
    return roleFromClient || 'USER';
  }

  @Get()
  async getOrders(
    @Query('status') status?: string,
    @Query('customerEmail') customerEmail?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const data = await this.ordersService.getOrders({
      status,
      customerEmail,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return ApiResponse.success(data);
  }

  @Get('refund-requests')
  async getRefundRequests(
    @Headers('authorization') authHeader?: string,
    @Query('role') roleFromQuery?: string,
  ) {
    const role = this.extractUserRole(authHeader, roleFromQuery);
    if (role !== 'SUPER_ADMIN' && role !== 'FINANCE_ADMIN' && role !== 'SUPPORT_ADMIN' && role !== 'ADMIN') {
      throw new ForbiddenException('شما دسترسی لازم به بخش سفارش‌های با درخواست عودت را ندارید.');
    }
    const data = await this.ordersService.getRefundRequests();
    return ApiResponse.success(data);
  }

  @Get(':id')
  async getOrder(@Param('id') id: string) {
    const data = await this.ordersService.getOrderById(id);
    return ApiResponse.success(data);
  }

  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    const order = await this.ordersService.createOrder(dto);
    return ApiResponse.success(order, 'سفارش با موفقیت ثبت شد.');
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Headers('authorization') authHeader?: string,
    @Body('role') roleFromBody?: string,
  ) {
    const role = this.extractUserRole(authHeader, roleFromBody);
    if (role !== 'SUPER_ADMIN' && role !== 'SUPPORT_ADMIN' && role !== 'CATALOG_MANAGER' && role !== 'FINANCE_ADMIN') {
      throw new ForbiddenException('شما دسترسی لازم برای تغییر وضعیت سفارش را ندارید.');
    }
    const updated = await this.ordersService.updateStatus(id, dto);
    return ApiResponse.success(updated, 'وضعیت سفارش با موفقیت تغییر یافت.');
  }

  @Post(':id/request-refund')
  async requestRefund(
    @Param('id') id: string,
    @Body() dto: RequestRefundDto,
  ) {
    const updated = await this.ordersService.requestRefund(id, dto);
    return ApiResponse.success(updated, 'درخواست عودت وجه با موفقیت ثبت گردید و در صف بررسی مالی قرار گرفت.');
  }

  @Post('process-refund')
  async processRefund(
    @Body() dto: ProcessRefundDto,
    @Headers('authorization') authHeader?: string,
    @Body('role') roleFromBody?: string,
  ) {
    const role = this.extractUserRole(authHeader, roleFromBody);
    if (role !== 'SUPER_ADMIN' && role !== 'FINANCE_ADMIN') {
      throw new ForbiddenException('فقط مدیر ارشد و مدیر مالی مجاز به تسویه عودت وجه هستند.');
    }
    const updated = await this.ordersService.processRefund(dto);
    return ApiResponse.success(updated, 'تسویه عودت وجه با موفقیت انجام شد و رسید به ایمیل مشتری ارسال گردید.');
  }
}
