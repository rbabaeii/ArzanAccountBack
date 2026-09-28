import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

// Ensure root upload directory exists
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

// Disallow SVG to prevent Stored XSS via script execution
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3 MB max

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'CATALOG_MANAGER', 'ADMIN')
@Controller('upload')
export class MediaController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req: any, file, cb) => {
          let folder = req.query?.folder || 'products';
          // Sanitize folder to avoid directory traversal
          folder = String(folder).replace(/[^a-zA-Z0-9_-]/g, '');
          const targetDir = path.join(UPLOAD_ROOT, folder);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          cb(null, targetDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const ext = path.extname(file.originalname).toLowerCase();
          const cleanName = path
            .basename(file.originalname, ext)
            .replace(/[^a-zA-Z0-9_-]/g, '')
            .substring(0, 30);
          cb(null, `${cleanName || 'upload'}-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: MAX_FILE_SIZE,
      },
      fileFilter: (req, file, cb) => {
        const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();

        if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !allowedExts.includes(ext)) {
          return cb(
            new BadRequestException(
              'فرمت فایل پشتیبانی نمی‌شود. لطفاً تصویری با فرمت JPEG، PNG یا WEBP انتخاب فرمایید.',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    @Query('folder') folderQuery?: string,
  ) {
    if (!file) {
      throw new BadRequestException('هیچ فایلی ارسال نشده است.');
    }

    const folder = (folderQuery || 'products').replace(/[^a-zA-Z0-9_-]/g, '');
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:4000';
    const fileUrl = `${protocol}://${host}/uploads/${folder}/${file.filename}`;

    return {
      success: true,
      url: fileUrl,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      folder,
    };
  }
}
