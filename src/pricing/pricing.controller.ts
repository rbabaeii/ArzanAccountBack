import { Controller, Get, Query } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { ApiResponse } from '../common/dto/api-response.dto';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('rates')
  async getRates() {
    const [usdRate, defaultMargin] = await Promise.all([
      this.pricingService.getUsdToRialRate(),
      this.pricingService.getDefaultMargin(),
    ]);
    return ApiResponse.success({
      usdToRialRate: usdRate,
      usdToTomanRate: Math.round(usdRate / 10),
      defaultMarginPercent: defaultMargin,
    });
  }

  @Get('preview')
  async getPreview(
    @Query('rate') rate?: string,
    @Query('margin') margin?: string,
  ) {
    const customRate = rate ? parseFloat(rate) : undefined;
    const customMargin = margin ? parseFloat(margin) : undefined;
    const preview = await this.pricingService.previewCalculations([5, 10, 20], customRate, customMargin);
    return ApiResponse.success(preview, 'پیش‌نمایش محاسبات محاسبه شد.');
  }
}
