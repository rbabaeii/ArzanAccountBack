import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (isPublic) {
        return true;
      }
      throw new UnauthorizedException('توکن احراز هویت ارائه نشده است.');
    }

    const token = authHeader.substring(7).trim();
    try {
      const payload = this.jwtService.verify(token);
      const userId = payload.sub || payload.id;

      // Invalidate blocked or deleted users immediately
      if (userId && this.prisma?.user) {
        const dbUser = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, role: true, status: true, email: true, phone: true, name: true },
        });

        if (dbUser) {
          if (dbUser.status === 'BLOCKED') {
            if (isPublic) return true;
            throw new UnauthorizedException('حساب کاربری شما مسدود گردیده است.');
          }
          request.user = {
            ...payload,
            ...dbUser,
          };
          request.userId = dbUser.id;
          return true;
        }

        // User not found in DB (deleted account or forged sub) — deny non-public routes
        if (isPublic) return true;
        throw new UnauthorizedException('کاربر یافت نشد یا حساب کاربری حذف شده است.');
      }

      // Prisma not available (edge case) — fall back to JWT payload only for public routes
      if (isPublic) {
        request.user = { ...payload, id: userId };
        request.userId = userId;
        return true;
      }
      throw new UnauthorizedException('سرویس احراز هویت در دسترس نیست.');
    } catch (err) {
      if (isPublic) {
        return true;
      }
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('توکن احراز هویت نامعتبر یا منقضی شده است.');
    }
  }
}
