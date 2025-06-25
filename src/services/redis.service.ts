import { Redis } from 'ioredis';
import { config } from '../config/env';

/**
 * Сервис для работы с Redis
 */
class RedisService {
	private client: Redis;

	constructor() {
		// Используем URL для подключения к Redis
		this.client = new Redis(config.redis.url);

		this.client.on('error', (err) => {
			console.error('Ошибка Redis:', err);
		});

		this.client.on('connect', () => {
			console.log('Успешное подключение к Redis');
		});
	}

	/**
	 * Получить значение по ключу
	 */
	async get(key: string): Promise<string | null> {
		return this.client.get(key);
	}

	/**
	 * Установить значение по ключу
	 */
	async set(key: string, value: string, ttl?: number): Promise<'OK'> {
		if (ttl) {
			return this.client.set(key, value, 'EX', ttl);
		}
		return this.client.set(key, value);
	}

	/**
	 * Удалить значение по ключу
	 */
	async delete(key: string): Promise<number> {
		return this.client.del(key);
	}

	/**
	 * Проверить наличие ключа
	 */
	async exists(key: string): Promise<number> {
		return this.client.exists(key);
	}

	/**
	 * Очистить все кеши
	 */
	async flushAll(): Promise<'OK'> {
		return this.client.flushall();
	}

	/**
	 * Получить ключи по шаблону
	 */
	async keys(pattern: string): Promise<string[]> {
		return this.client.keys(pattern);
	}

	/**
	 * Удалить несколько ключей
	 */
	async deleteMany(keys: string[]): Promise<number> {
		if (keys.length === 0) return 0;
		return this.client.del(...keys);
	}
}

export const redisService = new RedisService();
