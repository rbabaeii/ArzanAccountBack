import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('دسترسی غیرمجاز: اطلاعات نقش کاربر یافت نشد.');
    }

    // SUPER_ADMIN has full administrative privileges across all endpoints
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    // Strict role check
    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException(
        `دسترسی غیرمجاز: این عملیات نیازمند نقش [${requiredRoles.join(', ')}] است.`,
      );
    }

    return true;
  }
}
