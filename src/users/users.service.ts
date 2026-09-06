import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserRoleDto, UpdateUserStatusDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsers(params?: {
    role?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (params?.role && params.role !== 'all') {
      where.role = params.role;
    }

    if (params?.status && params.status !== 'all') {
      where.status = params.status;
    }

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search } },
        { email: { contains: params.search } },
        { phone: { contains: params.search } },
      ];
    }

    const [users, totalCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        take: params?.limit ? Number(params.limit) : 50,
        skip: params?.offset ? Number(params.offset) : 0,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      totalCount,
    };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('کاربر یافت نشد.');
    return user;
  }

  async getUserStats() {
    const [totalUsers, activeUsers, totalAdmins, twoFactorCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { role: { not: 'USER' } } }),
      this.prisma.user.count({ where: { isTwoFactorEnabled: true } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalAdmins,
      twoFactorCount,
    };
  }

  async createUser(dto: CreateUserDto, author = 'مدیر سیستم') {
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        password: dto.password,
        role: dto.role || 'USER',
        status: dto.status || 'ACTIVE',
        isTwoFactorEnabled: dto.isTwoFactorEnabled ?? false,
        avatar: dto.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: `ایجاد کاربر / مدیر جدید (${user.name})`,
        details: `کاربر با نقش ${user.role} توسط ${author} ایجاد شد.`,
        user: author,
        type: 'security',
      },
    });

    return user;
  }

  async updateUserRole(id: string, dto: UpdateUserRoleDto, author = 'مدیر سیستم') {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('کاربر یافت نشد.');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
    });

    await this.prisma.auditLog.create({
      data: {
        action: `تغییر سطح دسترسی کاربر (${user.name})`,
        details: `نقش کاربری از ${user.role} به ${dto.role} تغییر یافت.`,
        user: dto.adminUser || author,
        type: 'security',
      },
    });

    return updated;
  }

  async updateUserStatus(id: string, dto: UpdateUserStatusDto, author = 'مدیر سیستم') {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('کاربر یافت نشد.');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.prisma.auditLog.create({
      data: {
        action: `تغییر وضعیت حساب کاربر (${user.name})`,
        details: `وضعیت حساب به ${dto.status === 'ACTIVE' ? 'فعال' : 'مسدود'} تغییر یافت.`,
        user: dto.adminUser || author,
        type: 'security',
      },
    });

    return updated;
  }

  async deleteUser(id: string, author = 'مدیر سیستم') {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('کاربر یافت نشد.');

    await this.prisma.user.delete({ where: { id } });

    await this.prisma.auditLog.create({
      data: {
        action: `حذف حساب کاربری (${user.name})`,
        details: `حساب کاربری ${user.name} (${user.email || user.phone}) حذف گردید.`,
        user: author,
        type: 'security',
      },
    });

    return { success: true, message: 'کاربر با موفقیت حذف شد.' };
  }
}
