import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CalculatedPrice {
  costUsd: number;
  retailUsd: number;
  usdToRialRate: number;
  usdToTomanRate: number;
  costToman: number;
  publicRetailToman: number;
  marginPercent: number;
  isCustomMarginActive: boolean;
  baseRial: number;
  finalRial: number;
  finalToman: number;
  profitToman: number;
  discountPercent: number;
  formattedToman: string;
  formattedCostToman: string;
  formattedPublicRetailToman: string;
  isPerThousand: boolean;
}

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsdToRialRate(): Promise<number> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'USD_TO_RIAL_RATE' },
    });
    return setting ? parseFloat(setting.value) : 720000;
  }

  async getDefaultMargin(): Promise<number> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'DEFAULT_MARGIN_PERCENT' },
    });
    return setting ? parseFloat(setting.value) : 15;
  }

  async calculatePrice(
    costPriceUsd: number,
    retailPriceUsd?: number | null,
    customMarginPercent?: number | null,
    pricingUnit = 'unit',
  ): Promise<CalculatedPrice> {
    const [usdRate, defaultMargin] = await Promise.all([
      this.getUsdToRialRate(),
      this.getDefaultMargin(),
    ]);

    const effectiveRetailUsd = retailPriceUsd && retailPriceUsd > 0 ? retailPriceUsd : costPriceUsd;
    const usdToTomanRate = Math.round(usdRate / 10);
    const costToman = Math.round((costPriceUsd * usdRate) / 10);
    const publicRetailToman = Math.round((effectiveRetailUsd * usdRate) / 10);

    const isCustomMarginActive =
      customMarginPercent !== null &&
      customMarginPercent !== undefined &&
      customMarginPercent > 0;

    const marginPercent = isCustomMarginActive ? customMarginPercent : (defaultMargin || 0);

    let finalToman = 0;
    if (isCustomMarginActive || !retailPriceUsd || retailPriceUsd <= 0) {
      finalToman = Math.round(costToman * (1 + marginPercent / 100));
    } else {
      if (defaultMargin && defaultMargin > 0) {
        finalToman = Math.round(costToman * (1 + defaultMargin / 100));
      } else {
        finalToman = publicRetailToman;
      }
    }

    const baseRial = costPriceUsd * usdRate;
    const finalRial = finalToman * 10;
    const profitToman = Math.max(0, finalToman - costToman);
    const discountPercent =
      publicRetailToman > finalToman
        ? Math.round(((publicRetailToman - finalToman) / publicRetailToman) * 100)
        : 0;

    return {
      costUsd: costPriceUsd,
      retailUsd: effectiveRetailUsd,
      usdToRialRate: usdRate,
      usdToTomanRate,
      costToman,
      publicRetailToman,
      marginPercent,
      isCustomMarginActive,
      baseRial,
      finalRial,
      finalToman,
      profitToman,
      discountPercent,
      formattedToman: new Intl.NumberFormat('fa-IR').format(finalToman),
      formattedCostToman: new Intl.NumberFormat('fa-IR').format(costToman),
      formattedPublicRetailToman: new Intl.NumberFormat('fa-IR').format(publicRetailToman),
      isPerThousand: pricingUnit === 'per_1000',
    };
  }

  async previewCalculations(usdValues: number[] = [5, 10, 20], customRate?: number, customMargin?: number) {
    const defaultRate = customRate ?? (await this.getUsdToRialRate());
    const defaultMargin = customMargin ?? (await this.getDefaultMargin());

    return usdValues.map((costUsd) => {
      const baseRial = costUsd * defaultRate;
      const finalRial = Math.round(baseRial * (1 + defaultMargin / 100));
      const finalToman = Math.round(finalRial / 10);
      return {
        costUsd,
        usdToRialRate: defaultRate,
        marginPercent: defaultMargin,
        baseRial,
        finalRial,
        finalToman,
        formattedToman: new Intl.NumberFormat('fa-IR').format(finalToman),
      };
    });
  }
}
