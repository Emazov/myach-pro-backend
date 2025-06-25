import { redisService } from '../services/redis.service';

/**
 * Опции кэширования
 */
interface CacheOptions {
	ttl?: number; // время жизни кэша в секундах
	keyPrefix?: string; // префикс для ключа кэша
}

/**
 * Функция для кэширования результатов асинхронных функций
 * @param fn Асинхронная функция, результат которой нужно кэшировать
 * @param key Ключ для кэширования
 * @param options Опции кэширования
 * @returns Результат выполнения функции (из кэша или новый)
 */
export async function withCache<T>(
	fn: () => Promise<T>,
	key: string,
	options: CacheOptions = {},
): Promise<T> {
	const { ttl = 3600, keyPrefix = 'cache:' } = options;
	const cacheKey = `${keyPrefix}${key}`;

	// Проверяем наличие данных в кэше
	const cachedData = await redisService.get(cacheKey);

	if (cachedData) {
		try {
			// Если данные есть, возвращаем их
			return JSON.parse(cachedData) as T;
		} catch (error) {
			console.error('Ошибка при парсинге кэша:', error);
			// Если ошибка парсинга, продолжаем выполнение функции
		}
	}

	// Если кэша нет или произошла ошибка, выполняем функцию
	const result = await fn();

	// Сохраняем результат в кэш
	try {
		await redisService.set(cacheKey, JSON.stringify(result), ttl);
	} catch (error) {
		console.error('Ошибка при сохранении в кэш:', error);
	}

	return result;
}

/**
 * Функция для очистки кэша по ключу или префиксу
 * @param keyPattern Ключ или шаблон ключа для очистки
 */
export async function invalidateCache(keyPattern: string): Promise<void> {
	try {
		// Получаем все ключи по шаблону
		const keys = await redisService.keys(keyPattern);

		// Если есть ключи, удаляем их
		if (keys.length > 0) {
			await redisService.deleteMany(keys);
		}
	} catch (error) {
		console.error('Ошибка при очистке кэша:', error);
	}
}
