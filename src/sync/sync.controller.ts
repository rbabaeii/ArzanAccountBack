import { Controller, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { SyncService } from './sync.service';
import { ApiResponse } from '../common/dto/api-response.dto';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('irmarket')
  async triggerSync(@Body('triggeredBy') triggeredBy?: string) {
    const result = await this.syncService.syncCatalog(triggeredBy || 'مدیر سیستم (پنل ادمین)');
    return ApiResponse.success(result, result.message);
  }

  @Post('product/:externalId')
  async syncSingleProduct(
    @Param('externalId', ParseIntPipe) externalId: number,
    @Body('triggeredBy') triggeredBy?: string,
  ) {
    const result = await this.syncService.syncSingleProduct(externalId, triggeredBy || 'مدیر سیستم');
    return ApiResponse.success(result, result.message);
  }
}
