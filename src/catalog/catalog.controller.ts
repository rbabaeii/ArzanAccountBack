import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { ApiResponse } from '../common/dto/api-response.dto';
import { CreateCategoryDto, UpdateProductDto } from './catalog.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('products')
  async getProducts(
    @Query('isActive') isActive?: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('isFlashDeal') isFlashDeal?: string,
    @Query('isFeatured') isFeatured?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const data = await this.catalogService.getProducts({
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      categoryId,
      search,
      isFlashDeal: isFlashDeal !== undefined ? isFlashDeal === 'true' : undefined,
      isFeatured: isFeatured !== undefined ? isFeatured === 'true' : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return ApiResponse.success(data);
  }

  @Get('products/:id')
  async getProduct(@Param('id') id: string) {
    const product = await this.catalogService.getProductById(id);
    return ApiResponse.success(product);
  }

  @Put('products/:id/toggle-active')
  async toggleActive(
    @Param('id') id: string,
    @Body('user') user?: string,
  ) {
    const updated = await this.catalogService.toggleProductActive(id, user);
    return ApiResponse.success(
      updated,
      `محصول به وضعیت ${updated.isActive ? 'فعال' : 'غیرفعال'} تغییر یافت.`,
    );
  }

  @Put('products/:id')
  async updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Body('user') user?: string,
  ) {
    const updated = await this.catalogService.updateProduct(id, dto, user);
    return ApiResponse.success(updated, 'مشخصات محصول با موفقیت بروزرسانی شد.');
  }

  @Get('categories')
  async getCategories() {
    const categories = await this.catalogService.getCategories();
    return ApiResponse.success(categories);
  }

  @Post('categories')
  async createCategory(@Body() dto: CreateCategoryDto) {
    const category = await this.catalogService.createCategory(dto);
    return ApiResponse.success(category, 'دسته‌بندی جدید با موفقیت ایجاد شد.');
  }

  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string) {
    await this.catalogService.deleteCategory(id);
    return ApiResponse.success(null, 'دسته‌بندی حذف گردید.');
  }
}
