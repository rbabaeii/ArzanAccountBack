import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface MemoryCacheEntry {
  value: string;
  expiresAt?: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redisClient: Redis | null = null;
  private isRedisActive = false;
  private readonly memoryCache = new Map<string, MemoryCacheEntry>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST');
    const port = this.configService.get<number>('REDIS_PORT') || 6379;
    const url = this.configService.get<string>('REDIS_URL');

    if (host || url) {
      this.logger.log(`Connecting to Redis at ${url || `${host}:${port}`}...`);
      try {
        const client = url
          ? new Redis(url, {
              connectTimeout: 3000,
              maxRetriesPerRequest: 1,
              retryStrategy: (times) => {
                if (times > 2) return null; // stop retrying after 2 attempts
                return Math.min(times * 500, 2000);
              },
            })
          : new Redis({
              host,
              port,
              connectTimeout: 3000,
              maxRetriesPerRequest: 1,
              retryStrategy: (times) => {
                if (times > 2) return null;
                return Math.min(times * 500, 2000);
              },
            });

        client.on('connect', () => {
          this.isRedisActive = true;
          this.logger.log(`✓ [RedisService] Connected to Redis successfully (${host || url})`);
        });

        client.on('error', (err) => {
          if (this.isRedisActive) {
            this.logger.warn(`[RedisService] Connection error: ${err.message}. Switching to In-Memory fallback.`);
          }
          this.isRedisActive = false;
        });

        this.redisClient = client;
      } catch (err: any) {
        this.logger.warn(`[RedisService] Failed to initialize Redis client (${err.message}). Using In-Memory Cache.`);
        this.isRedisActive = false;
      }
    } else {
      this.logger.log('[RedisService] No REDIS_HOST/REDIS_URL configured. Running seamlessly in In-Memory Cache mode.');
      this.isRedisActive = false;
    }
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        this.redisClient.disconnect();
      }
    }
  }

  /**
   * Retrieve a value by key
   */
  async get(key: string): Promise<string | null> {
    if (this.isRedisActive && this.redisClient) {
      try {
        return await this.redisClient.get(key);
      } catch (err: any) {
        this.logger.warn(`[RedisService] Error getting key "${key}" from Redis: ${err.message}. Falling back to memory.`);
      }
    }

    // In-memory fallback
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set a value with optional TTL (in seconds)
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.isRedisActive && this.redisClient) {
      try {
        if (ttlSeconds && ttlSeconds > 0) {
          await this.redisClient.set(key, value, 'EX', ttlSeconds);
        } else {
          await this.redisClient.set(key, value);
        }
        return;
      } catch (err: any) {
        this.logger.warn(`[RedisService] Error setting key "${key}" in Redis: ${err.message}. Falling back to memory.`);
      }
    }

    // In-memory fallback
    const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : undefined;
    this.memoryCache.set(key, { value, expiresAt });
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<void> {
    if (this.isRedisActive && this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (err: any) {
        this.logger.warn(`[RedisService] Error deleting key "${key}" in Redis: ${err.message}.`);
      }
    }

    this.memoryCache.delete(key);
  }

  /**
   * Flush all cache entries
   */
  async flush(): Promise<void> {
    if (this.isRedisActive && this.redisClient) {
      try {
        await this.redisClient.flushdb();
      } catch (err: any) {
        this.logger.warn(`[RedisService] Error flushing Redis db: ${err.message}.`);
      }
    }

    this.memoryCache.clear();
  }

  /**
   * Get operational health/mode status
   */
  getStatus(): { mode: 'REDIS' | 'IN_MEMORY'; isConnected: boolean; inMemoryKeysCount: number } {
    return {
      mode: this.isRedisActive ? 'REDIS' : 'IN_MEMORY',
      isConnected: this.isRedisActive,
      inMemoryKeysCount: this.memoryCache.size,
    };
  }
}
