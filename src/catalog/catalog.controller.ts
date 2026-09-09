import { Controller, Get, Post, Put, Delete, Body, Param, Query, Headers, ForbiddenException } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { ApiResponse } from '../common/dto/api-response.dto';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  UpdateProductDto,
  CreateProductDto,
  CreateTagDto,
  RenameTagDto,
  AssignTagDto,
} from './catalog.dto';
import { JwtService } from '@nestjs/jwt';

@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly jwtService: JwtService,
  ) {}

  private extractRole(authHeader?: string, roleFromBody?: string): string {
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload: any = this.jwtService.decode(token);
        if (payload?.role) return payload.role;
      } catch {}
    }
    return roleFromBody || 'USER';
  }

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

  @Get('products/:id/live-sync')
  async getLiveProduct(@Param('id') id: string) {
    const product = await this.catalogService.getLiveProduct(id);
    return ApiResponse.success(product, 'استعلام زنده محصول از تأمین‌کننده با موفقیت انجام شد.');
  }

  @Post('products/:id/validate-stock')
  async validateStock(
    @Param('id') id: string,
    @Body('quantity') quantity?: number,
  ) {
    const result = await this.catalogService.validateLiveStock(id, quantity || 1);
    return ApiResponse.success(result, 'موجودی کالا تأیید گردید.');
  }

  @Put('products/:id/toggle-active')
  async toggleActive(
    @Param('id') id: string,
    @Body('user') user?: string,
    @Body('role') roleFromBody?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const role = this.extractRole(authHeader, roleFromBody);
    if (role !== 'SUPER_ADMIN' && role !== 'CATALOG_MANAGER') {
      throw new ForbiddenException('شما دسترسی مجاز برای تغییر وضعیت انتشار محصولات را ندارید.');
    }
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
    @Body('role') roleFromBody?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const role = this.extractRole(authHeader, roleFromBody);
    if (role !== 'SUPER_ADMIN' && role !== 'CATALOG_MANAGER') {
      throw new ForbiddenException('شما دسترسی مجاز برای ویرایش محصولات را ندارید.');
    }
    const updated = await this.catalogService.updateProduct(id, dto, user);
    return ApiResponse.success(updated, 'مشخصات محصول با موفقیت بروزرسانی شد.');
  }

  @Post('products')
  async createProduct(
    @Body() dto: CreateProductDto,
    @Body('user') user?: string,
    @Body('role') roleFromBody?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const role = this.extractRole(authHeader, roleFromBody);
    if (role !== 'SUPER_ADMIN' && role !== 'CATALOG_MANAGER') {
      throw new ForbiddenException('شما دسترسی مجاز برای افزودن محصول را ندارید.');
    }
    const created = await this.catalogService.createProduct(dto, user);
    return ApiResponse.success(created, 'محصول جدید با موفقیت ایجاد شد.');
  }

  // ==========================================
  // TAG MANAGEMENT ENDPOINTS
  // ==========================================
  @Get('tags')
  async getAllTags() {
    const tags = await this.catalogService.getAllTags();
    return ApiResponse.success(tags);
  }

  @Post('tags')
  async createTag(
    @Body() dto: CreateTagDto,
    @Body('user') user?: string,
    @Body('role') roleFromBody?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const role = this.extractRole(authHeader, roleFromBody);
    if (role !== 'SUPER_ADMIN' && role !== 'CATALOG_MANAGER') {
      throw new ForbiddenException('شما دسترسی مجاز برای ایجاد برچسب را ندارید.');
    }
    const result = await this.catalogService.createTag(dto, user);
    return ApiResponse.success(result, `برچسب «${dto.tag}» با موفقیت ایجاد گردید.`);
  }

  @Put('tags/rename')
  async renameTag(
    @Body() dto: RenameTagDto,
    @Body('user') user?: string,
    @Body('role') roleFromBody?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const role = this.extractRole(authHeader, roleFromBody);
    if (role !== 'SUPER_ADMIN' && role !== 'CATALOG_MANAGER') {
      throw new ForbiddenException('شما دسترسی مجاز برای ویرایش برچسب را ندارید.');
    }
    const result = await this.catalogService.renameTag(dto, user);
    return ApiResponse.success(result, `نام برچسب از «${dto.oldTag}» به «${dto.newTag}» تغییر یافت.`);
  }

  @Delete('tags/:tag')
  async deleteTag(
    @Param('tag') tag: string,
    @Body('user') user?: string,
    @Body('role') roleFromBody?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const role = this.extractRole(authHeader, roleFromBody);
    if (role !== 'SUPER_ADMIN' && role !== 'CATALOG_MANAGER') {
      throw new ForbiddenException('شما دسترسی مجاز برای حذف برچسب را ندارید.');
    }
    const result = await this.catalogService.deleteTag(tag, user);
    return ApiResponse.success(result, `برچسب «${tag}» با موفقیت حذف گردید.`);
  }

  @Post('tags/assign')
  async assignTag(
    @Body() dto: AssignTagDto,
    @Body('user') user?: string,
    @Body('role') roleFromBody?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const role = this.extractRole(authHeader, roleFromBody);
    if (role !== 'SUPER_ADMIN' && role !== 'CATALOG_MANAGER') {
      throw new ForbiddenException('شما دسترسی مجاز برای تغییر برچسب محصولات را ندارید.');
    }
    const result = await this.catalogService.assignTag(dto, user);
    return ApiResponse.success(result, 'عملیات تخصیص برچسب با موفقیت انجام شد.');
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

  @Put('categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const updated = await this.catalogService.updateCategory(id, dto);
    return ApiResponse.success(updated, 'دسته‌بندی با موفقیت ویرایش شد.');
  }

  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string) {
    await this.catalogService.deleteCategory(id);
    return ApiResponse.success(null, 'دسته‌بندی حذف گردید.');
  }
}
