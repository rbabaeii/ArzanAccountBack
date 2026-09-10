import { Controller, Get, Post, Query, Param } from '@nestjs/common';
import { SearchService } from './search.service';
import { ApiResponse } from '../common/dto/api-response.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * Live ElasticSearch Instant Search Endpoint
   */
  @Get('live')
  searchLive(
    @Query('q') query?: string,
    @Query('scope') scope?: 'public' | 'admin' | 'all',
    @Query('limit') limit?: string,
  ) {
    const result = this.searchService.search({
      query: query || '',
      scope: scope || 'public',
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
   */
  @Post('reindex')
  async triggerReindex() {
    await this.searchService.reindexAll();
    return ApiResponse.success({ message: 'ایندکس‌سازی موتور جستجو با موفقیت به‌روزرسانی شد.' });
  }
}
