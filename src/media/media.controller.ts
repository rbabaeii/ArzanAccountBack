import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';

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

function isValidImageMagicBytes(filePath: string): boolean {
  try {
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    if (bytesRead < 4) return false;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return true;
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytesRead >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return true;
    }
    // WEBP: RIFF .... WEBP
    if (
      bytesRead >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

@Controller('upload')
export class MediaController {
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @Public()
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req: any, file, cb) => {
          let folder = String(req.query?.folder || 'products').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'products';
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
      fileFilter: (req: any, file, cb) => {
        let folder = String(req.query?.folder || 'products').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'products';

        // Receipts folder is open to customers/guests for bank payment receipts.
        // All other folders (products, branding, etc.) strictly require admin privileges.
        if (folder !== 'receipts') {
          const user = req.user;
          const isAdmin = user && ['SUPER_ADMIN', 'CATALOG_MANAGER', 'ADMIN'].includes(user.role);
          if (!isAdmin) {
            return cb(
              new ForbiddenException('دسترسی غیرمجاز. فقط مدیران مجاز به بارگذاری فایل در این بخش هستند.'),
              false,
            );
          }
        }

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
    @Req() req: any,
    @Query('folder') folderQuery?: string,
  ) {
    if (!file) {
      throw new BadRequestException('هیچ فایلی ارسال نشده است.');
    }

    if (file.path && !isValidImageMagicBytes(file.path)) {
      try {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      } catch {}
      throw new BadRequestException('محتوای باینری فایل با یک تصویر معتبر (JPEG, PNG, WEBP) مطابقت ندارد.');
    }

    const folder = String(folderQuery || 'products').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'products';

    // Secondary defense-in-depth authorization check
    if (folder !== 'receipts') {
      const user = req.user;
      const isAdmin = user && ['SUPER_ADMIN', 'CATALOG_MANAGER', 'ADMIN'].includes(user.role);
      if (!isAdmin) {
        try {
          if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        } catch {}
        throw new ForbiddenException('دسترسی غیرمجاز. فقط مدیران مجاز به بارگذاری فایل در این بخش هستند.');
      }
    }

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
