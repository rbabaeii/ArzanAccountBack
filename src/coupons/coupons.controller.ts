import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CouponsService } from './coupons.service';
import { ApiResponse } from '../common/dto/api-response.dto';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('validate')
  async validate(@Body('code') code: string, @Body('userId') userId?: string) {
    const result = await this.couponsService.validateCoupon(code, userId);
    return ApiResponse.success(result);
  }
}
