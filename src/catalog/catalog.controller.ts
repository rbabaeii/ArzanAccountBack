import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @UseGuards(JwtAuthGuard)
  @Public()
  @Get('products')
  async getProducts(
    @Query('isActive') isActive?: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('isFlashDeal') isFlashDeal?: string,
    @Query('isFeatured') isFeatured?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @CurrentUser() user?: any,
  ) {
    const isAdmin = Boolean(
      user && ['SUPER_ADMIN', 'CATALOG_MANAGER', 'FINANCE_ADMIN', 'ADMIN'].includes(user.role),
    );
    const data = await this.catalogService.getProducts(
      {
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        categoryId,
        search,
        isFlashDeal: isFlashDeal !== undefined ? isFlashDeal === 'true' : undefined,
        isFeatured: isFeatured !== undefined ? isFeatured === 'true' : undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      },
      isAdmin,
    );
    return ApiResponse.success(data);
  }

  @UseGuards(JwtAuthGuard)
  @Public()
  @Get('products/:id')
  async getProduct(@Param('id') id: string, @CurrentUser() user?: any) {
    const isAdmin = Boolean(
      user && ['SUPER_ADMIN', 'CATALOG_MANAGER', 'FINANCE_ADMIN', 'ADMIN'].includes(user.role),
    );
    const product = await this.catalogService.getProductById(id, isAdmin);
    return ApiResponse.success(product);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CATALOG_MANAGER')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get('products/:id/live-sync')
  async getLiveProduct(@Param('id') id: string) {
    const product = await this.catalogService.getLiveProduct(id);
    return ApiResponse.success(product, 'استعلام زنده محصول از تأمین‌کننده با موفقیت انجام شد.');
  }

  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post('products/:id/validate-stock')
  async validateStock(
    @Param('id') id: string,
    @Body('quantity') quantity?: number,
  ) {
    const result = await this.catalogService.validateLiveStock(id, quantity || 1);
    return ApiResponse.success(result, 'موجودی کالا تأیید گردید.');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CATALOG_MANAGER')
  @Put('products/:id/toggle-active')
  async toggleActive(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const admin = {
      id: user.id || user.sub,
      name: user.name || 'مدیر سیستم',
      phone: user.phone,
      role: user.role,
    };
    const updated = await this.catalogService.toggleProductActive(id, admin);
    return ApiResponse.success(
      updated,
      `محصول به وضعیت ${updated.isActive ? 'فعال' : 'غیرفعال'} تغییر یافت.`,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CATALOG_MANAGER')
  @Put('products/:id')
  async updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: any,
  ) {
    const admin = {
      id: user.id || user.sub,
      name: user.name || 'مدیر سیستم',
      phone: user.phone,
      role: user.role,
    };
    const updated = await this.catalogService.updateProduct(id, dto, admin);
    return ApiResponse.success(updated, 'مشخصات محصول با موفقیت بروزرسانی شد.');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CATALOG_MANAGER')
  @Post('products')
  async createProduct(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: any,
  ) {
    const admin = {
      id: user.id || user.sub,
      name: user.name || 'مدیر سیستم',
      phone: user.phone,
      role: user.role,
    };
    const created = await this.catalogService.createProduct(dto, admin);
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CATALOG_MANAGER')
  @Post('tags')
  async createTag(
    @Body() dto: CreateTagDto,
    @CurrentUser('name') userName?: string,
  ) {
    const result = await this.catalogService.createTag(dto, userName || 'مدیر سیستم');
    return ApiResponse.success(result, `برچسب «${dto.tag}» با موفقیت ایجاد گردید.`);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CATALOG_MANAGER')
  @Put('tags/rename')
  async renameTag(
    @Body() dto: RenameTagDto,
    @CurrentUser('name') userName?: string,
  ) {
    const result = await this.catalogService.renameTag(dto, userName || 'مدیر سیستم');
    return ApiResponse.success(result, `نام برچسب از «${dto.oldTag}» به «${dto.newTag}» تغییر یافت.`);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CATALOG_MANAGER')
  @Delete('tags/:tag')
  async deleteTag(
    @Param('tag') tag: string,
    @CurrentUser('name') userName?: string,
  ) {
    const result = await this.catalogService.deleteTag(tag, userName || 'مدیر سیستم');
    return ApiResponse.success(result, `برچسب «${tag}» با موفقیت حذف گردید.`);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CATALOG_MANAGER')
  @Post('tags/assign')
  async assignTag(
    @Body() dto: AssignTagDto,
    @CurrentUser('name') userName?: string,
  ) {
    const result = await this.catalogService.assignTag(dto, userName || 'مدیر سیستم');
    return ApiResponse.success(result, 'عملیات تخصیص برچسب با موفقیت انجام شد.');
  }

  @Get('categories')
  async getCategories(
    @Query('hasActiveProducts') hasActiveProducts?: string,
    @Query('onlyActive') onlyActive?: string,
  ) {
    const filterActive =
      hasActiveProducts === 'true' ||
      hasActiveProducts === '1' ||
      onlyActive === 'true' ||
      onlyActive === '1';
    const categories = await this.catalogService.getCategories(filterActive);
    return ApiResponse.success(categories);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CATALOG_MANAGER')
  @Post('categories')
  async createCategory(@Body() dto: CreateCategoryDto) {
    const category = await this.catalogService.createCategory(dto);
    return ApiResponse.success(category, 'دسته‌بندی جدید با موفقیت ایجاد شد.');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CATALOG_MANAGER')
  @Put('categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const updated = await this.catalogService.updateCategory(id, dto);
    return ApiResponse.success(updated, 'دسته‌بندی با موفقیت ویرایش شد.');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'CATALOG_MANAGER')
  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string) {
    await this.catalogService.deleteCategory(id);
    return ApiResponse.success(null, 'دسته‌بندی حذف گردید.');
  }
}
