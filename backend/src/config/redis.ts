import { Redis } from "@upstash/redis";
import { env } from "./env";

export interface CacheClient {
  readonly mode: "upstash" | "memory";
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

class InMemoryCache implements CacheClient {
  public readonly mode = "memory" as const;
  private store = new Map<string, { value: unknown; expiresAt?: number }>();

  public async get<T>(key: string): Promise<T | null> {
    const record = this.store.get(key);
    if (!record) {
      return null;
    }

    if (record.expiresAt && Date.now() > record.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return record.value as T;
  }

  public async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  public async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

class UpstashCache implements CacheClient {
  public readonly mode = "upstash" as const;

  constructor(private readonly redis: Redis) {}

  public async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get<T>(key);
    return value ?? null;
  }

  public async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.set(key, value, { ex: ttlSeconds });
      return;
    }

    await this.redis.set(key, value);
  }

  public async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

function canUseUpstash(): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

export const cache: CacheClient = canUseUpstash()
  ? new UpstashCache(
      new Redis({
        url: env.UPSTASH_REDIS_REST_URL!,
        token: env.UPSTASH_REDIS_REST_TOKEN!
      })
    )
  : new InMemoryCache();
