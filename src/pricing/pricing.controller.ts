import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { ApiResponse } from '../common/dto/api-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @UseGuards(JwtAuthGuard)
  @Public()
  @Get('rates')
  async getRates(@CurrentUser() user?: any) {
    const isAdmin = Boolean(
      user && ['SUPER_ADMIN', 'FINANCE_ADMIN', 'ADMIN'].includes(user.role),
    );
    const [usdRate, defaultMargin] = await Promise.all([
      this.pricingService.getUsdToRialRate(),
      this.pricingService.getDefaultMargin(),
    ]);
    return ApiResponse.success({
      usdToRialRate: usdRate,
      usdToTomanRate: Math.round(usdRate / 10),
      ...(isAdmin ? { defaultMarginPercent: defaultMargin } : {}),
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'FINANCE_ADMIN')
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
