import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { IrMarketService } from './irmarket.service';
import { ApiResponse } from '../common/dto/api-response.dto';
import { IrMarketPurchaseRequest } from './irmarket.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('irmarket')
export class IrMarketController {
  constructor(private readonly irMarketService: IrMarketService) {}

  @Get('me')
  async getMe() {
    const data = await this.irMarketService.getMe();
    return ApiResponse.success(data, 'اطلاعات حساب کاربری irMarket با موفقیت دریافت شد.');
  }

  @Get('balance')
  async getBalance() {
    const data = await this.irMarketService.getBalance();
    return ApiResponse.success(data, 'موجودی لحظه‌ای کیف پول استعلام شد.');
  }

  @Get('products')
  async getProducts() {
    const data = await this.irMarketService.getProducts();
    return ApiResponse.success(data, `${data.length} محصول از وب‌سرویس مرجع دریافت گردید.`);
  }

  @Get('orders/:id')
  async getOrder(@Param('id') id: string) {
    const data = await this.irMarketService.getOrder(id);
    return ApiResponse.success(data, 'وضعیت سفارش استعلام شد.');
  }

  @Post('purchase')
  async purchase(@Body() body: IrMarketPurchaseRequest) {
    const data = await this.irMarketService.purchaseProduct(body);
    return ApiResponse.success(data, 'عملیات خرید انجام شد.');
  }
}
