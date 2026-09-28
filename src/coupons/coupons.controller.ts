import { Controller, Post, Body } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { ApiResponse } from '../common/dto/api-response.dto';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post('validate')
  async validate(@Body('code') code: string, @Body('userId') userId?: string) {
    const result = await this.couponsService.validateCoupon(code, userId);
    return ApiResponse.success(result);
  }
}
