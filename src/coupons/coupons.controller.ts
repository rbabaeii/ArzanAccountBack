import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, UpdateCouponDto } from './coupons.dto';
import { ApiResponse } from '../common/dto/api-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @Public()
  @Post('validate')
  async validate(
    @Body('code') code: string,
    @CurrentUser('id') authUserId?: string,
  ) {
    const result = await this.couponsService.validateCoupon(code, authUserId);
    return ApiResponse.success(result);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
  @Get()
  async getAllCoupons() {
    const coupons = await this.couponsService.getAllCoupons();
    return ApiResponse.success(coupons);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
  @Get(':id')
  async getCouponById(@Param('id') id: string) {
    const coupon = await this.couponsService.getCouponById(id);
    return ApiResponse.success(coupon);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
  @Post()
  async createCoupon(@Body() dto: CreateCouponDto) {
    const coupon = await this.couponsService.createCoupon(dto);
    return ApiResponse.success(coupon, 'کد تخفیف با موفقیت ایجاد گردید.');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
  @Put(':id')
  async updateCoupon(
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    const coupon = await this.couponsService.updateCoupon(id, dto);
    return ApiResponse.success(coupon, 'کد تخفیف با موفقیت بروزرسانی شد.');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
  @Delete(':id')
  async deleteCoupon(@Param('id') id: string) {
    const result = await this.couponsService.deleteCoupon(id);
    return ApiResponse.success(result, 'کد تخفیف با موفقیت حذف گردید.');
  }
}
