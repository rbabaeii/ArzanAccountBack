import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CalculatedPrice {
  costUsd: number;
  usdToRialRate: number;
  marginPercent: number;
  baseRial: number;
  finalRial: number;
  finalToman: number;
  formattedToman: string;
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
    customMarginPercent?: number | null,
    pricingUnit = 'unit',
  ): Promise<CalculatedPrice> {
    const [usdRate, defaultMargin] = await Promise.all([
      this.getUsdToRialRate(),
      this.getDefaultMargin(),
    ]);

    const margin = customMarginPercent ?? defaultMargin;
    const baseRial = costPriceUsd * usdRate;
    const finalRial = Math.round(baseRial * (1 + margin / 100));
    const finalToman = Math.round(finalRial / 10);

    return {
      costUsd: costPriceUsd,
      usdToRialRate: usdRate,
      marginPercent: margin,
      baseRial,
      finalRial,
      finalToman,
      formattedToman: new Intl.NumberFormat('fa-IR').format(finalToman),
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
