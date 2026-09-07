import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { Request } from 'express';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

// Ensure root upload directory exists
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

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
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              'فرمت فایل پشتیبانی نمی‌شود. لطفاً تصویری با فرمت JPEG، PNG، WEBP یا SVG انتخاب کنید.',
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
