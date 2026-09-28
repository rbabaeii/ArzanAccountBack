import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
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
      request.user = {
        ...payload,
        id: payload.sub || payload.id,
      };
      request.userId = payload.sub || payload.id;
      return true;
    } catch (err) {
      if (isPublic) {
        return true;
      }
      throw new UnauthorizedException('توکن احراز هویت نامعتبر یا منقضی شده است.');
    }
  }
}
