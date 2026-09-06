import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      await this.$connect();
      console.log('✅ Connected to database successfully.');
    } catch (e) {
      console.warn('⚠️ Could not connect to database immediately. Will retry on demand.', e.message);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
