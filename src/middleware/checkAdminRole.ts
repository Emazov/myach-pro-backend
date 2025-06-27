import { Response, NextFunction } from 'express';
import { TelegramRequest } from '../types/api';
import { prisma } from '../prisma';
import { redisService } from '../services/redis.service';

// Кэш для проверки админов (TTL 5 минут)
const ADMIN_CACHE_TTL = 300;
const ADMIN_CACHE_PREFIX = 'admin:check:';

/**
 * Функция для инвалидации кэша конкретного админа
 */
export const invalidateAdminCache = async (
	telegramId: string,
): Promise<void> => {
	try {
		const cacheKey = `${ADMIN_CACHE_PREFIX}${telegramId}`;
		await redisService.delete(cacheKey);
	} catch (error) {
		console.warn(`Не удалось инвалидировать кэш админа ${telegramId}:`, error);
	}
};

/**
 * Функция для инвалидации всего кэша админов
 */
export const invalidateAllAdminCache = async (): Promise<void> => {
	try {
		const keys = await redisService.keys(`${ADMIN_CACHE_PREFIX}*`);
		if (keys.length > 0) {
			await redisService.deleteMany(keys);
		}
	} catch (error) {
		console.warn('Не удалось инвалидировать весь кэш админов:', error);
	}
};

/**
 * Middleware для проверки прав администратора по роли в базе данных
 */
export const checkAdminRole = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { telegramUser } = req.body;

		if (!telegramUser || !telegramUser.id) {
			res.status(403).json({
				error: 'Доступ запрещен. Необходимо авторизоваться',
			});
			return;
		}

		const telegramId = telegramUser.id.toString();
		const cacheKey = `${ADMIN_CACHE_PREFIX}${telegramId}`;

		// ОПТИМИЗАЦИЯ: Проверяем кэш сначала
		try {
			const cachedResult = await redisService.get(cacheKey);
			if (cachedResult !== null) {
				const isAdmin = cachedResult === 'true';
				if (isAdmin) {
					next();
					return;
				} else {
					res.status(403).json({
						error: 'Доступ запрещен. Недостаточно прав',
					});
					return;
				}
			}
		} catch (cacheError) {
			// Если кэш недоступен, продолжаем с DB запросом
			console.warn('Redis недоступен для проверки админа, используем DB');
		}

		// Проверяем роль пользователя в БД
		const user = await prisma.user.findUnique({
			where: { telegramId },
			select: { role: true }, // Выбираем только роль для оптимизации
		});

		const isAdmin = user?.role === 'admin';

		// Кэшируем результат
		try {
			await redisService.set(cacheKey, isAdmin.toString(), ADMIN_CACHE_TTL);
		} catch (cacheError) {
			// Ошибка кэширования не критична
			console.warn('Не удалось закэшировать результат проверки админа');
		}

		if (!isAdmin) {
			res.status(403).json({
				error: 'Доступ запрещен. Недостаточно прав',
			});
			return;
		}

		next();
	} catch (err) {
		console.error('Ошибка проверки прав доступа:', err);
		res.status(500).json({ error: 'Внутренняя ошибка сервера' });
	}
};
