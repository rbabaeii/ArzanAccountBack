import { Controller, Get, Post, Query, Param, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { ApiResponse } from '../common/dto/api-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * Live ElasticSearch Instant Search Endpoint
   * Restricted: Admin scope (orders & users PII) is only accessible to authenticated admins.
   * Public or unauthenticated queries default strictly to 'public' scope.
   */
  @UseGuards(JwtAuthGuard)
  @Public()
  @Get('live')
  searchLive(
    @Query('q') query?: string,
    @Query('scope') scope?: 'public' | 'admin' | 'all',
    @Query('limit') limit?: string,
    @CurrentUser() user?: any,
  ) {
    const isAdmin = user && ['SUPER_ADMIN', 'SUPPORT_ADMIN', 'ADMIN'].includes(user.role);
    const effectiveScope: 'public' | 'admin' | 'all' =
      isAdmin && (scope === 'admin' || scope === 'all') ? scope : 'public';

    const result = this.searchService.search({
      query: query || '',
      scope: effectiveScope,
      limit: limit ? Number(limit) : 10,
    });
    return ApiResponse.success(result);
  }

  /**
   * Search Products by Tag
   */
  @Get('by-tag')
  searchByTag(
    @Query('tag') tag?: string,
    @Query('limit') limit?: string,
  ) {
    if (!tag) {
      return ApiResponse.success([]);
    }
    const products = this.searchService.searchByTag(tag, limit ? Number(limit) : 20);
    return ApiResponse.success(products);
  }

  /**
   * Related Products by Tag Matching Algorithm
   */
  @Get('related/:id')
  getRelatedProducts(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const products = this.searchService.getRelatedProducts(id, limit ? Number(limit) : 4);
    return ApiResponse.success(products);
  }

  /**
   * Trigger Manual Reindex of Search Index
   * Guarded against DoS: Only SUPER_ADMIN is authorized to rebuild indexes.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Post('reindex')
  async triggerReindex() {
    await this.searchService.reindexAll();
    return ApiResponse.success({ message: 'ایندکس‌سازی موتور جستجو با موفقیت به‌روزرسانی شد.' });
  }
}
