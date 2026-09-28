import {
  Controller,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { SyncService } from './sync.service';
import { ApiResponse } from '../common/dto/api-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'CATALOG_MANAGER')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('irmarket')
  async triggerSync(@CurrentUser('name') userName?: string, @Body('triggeredBy') triggeredBy?: string) {
    const result = await this.syncService.syncCatalog(userName || triggeredBy || 'مدیر سیستم (پنل ادمین)');
    return ApiResponse.success(result, result.message);
  }

  @Post('product/:externalId')
  async syncSingleProduct(
    @Param('externalId', ParseIntPipe) externalId: number,
    @CurrentUser('name') userName?: string,
    @Body('triggeredBy') triggeredBy?: string,
  ) {
    const result = await this.syncService.syncSingleProduct(externalId, userName || triggeredBy || 'مدیر سیستم');
    return ApiResponse.success(result, result.message);
  }
}
