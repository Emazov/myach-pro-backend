import { Response, NextFunction } from 'express';
import { TelegramRequest } from '../types/api';
import { AnalyticsService, EventType } from '../services/analytics.service';
import { withCache, invalidateCache } from '../utils/cacheUtils';

// Константы для кэширования
const CACHE_KEYS = {
	STATS: 'analytics:stats',
	DETAILED_STATS: 'analytics:detailed_stats:',
};

/**
 * Логирует событие пользователя
 */
export const logEvent = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { telegramUser } = req.body;
		const { eventType, metadata } = req.body;

		if (!telegramUser) {
			res.status(400).json({ error: 'Данные пользователя не найдены' });
			return;
		}

		if (!eventType || !Object.values(EventType).includes(eventType)) {
			res.status(400).json({ error: 'Некорректный тип события' });
			return;
		}

		const telegramId = telegramUser.id.toString();
		await AnalyticsService.logEvent(telegramId, eventType, metadata);

		// Инвалидируем кэш статистики при новых событиях
		await invalidateCache(CACHE_KEYS.STATS);
		await invalidateCache(`${CACHE_KEYS.DETAILED_STATS}*`);

		res.json({ ok: true, message: 'Событие зарегистрировано' });
	} catch (error) {
		console.error('Ошибка при логировании события:', error);
		res.status(500).json({ error: 'Ошибка сервера' });
	}
};

/**
 * Начинает игровую сессию
 */
export const startGameSession = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { telegramUser } = req.body;
		const { clubId } = req.body;

		if (!telegramUser) {
			res.status(400).json({ error: 'Данные пользователя не найдены' });
			return;
		}

		if (!clubId) {
			res.status(400).json({ error: 'ID клуба обязателен' });
			return;
		}

		const telegramId = telegramUser.id.toString();
		const sessionId = await AnalyticsService.startGameSession(
			telegramId,
			clubId,
		);

		// Логируем событие запуска приложения (только при начале игры)
		await AnalyticsService.logEvent(telegramId, EventType.APP_START, {
			clubId,
		});

		// Логируем событие начала игры
		await AnalyticsService.logEvent(telegramId, EventType.GAME_START, {
			clubId,
		});

		// Инвалидируем кэш статистики при новых событиях
		await invalidateCache(CACHE_KEYS.STATS);
		await invalidateCache(`${CACHE_KEYS.DETAILED_STATS}*`);

		res.json({
			ok: true,
			sessionId,
			message: 'Игровая сессия начата',
		});
	} catch (error) {
		console.error('Ошибка при начале игровой сессии:', error);
		res.status(500).json({ error: 'Ошибка сервера' });
	}
};

/**
 * Завершает игровую сессию
 */
export const completeGameSession = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { telegramUser } = req.body;

		if (!telegramUser) {
			res.status(400).json({ error: 'Данные пользователя не найдены' });
			return;
		}

		const telegramId = telegramUser.id.toString();
		await AnalyticsService.completeGameSession(telegramId);

		// Логируем событие завершения игры
		await AnalyticsService.logEvent(telegramId, EventType.GAME_COMPLETED);

		// Инвалидируем кэш статистики при новых событиях
		await invalidateCache(CACHE_KEYS.STATS);
		await invalidateCache(`${CACHE_KEYS.DETAILED_STATS}*`);

		res.json({
			ok: true,
			message: 'Игровая сессия завершена',
		});
	} catch (error) {
		console.error('Ошибка при завершении игровой сессии:', error);
		res.status(500).json({ error: 'Ошибка сервера' });
	}
};

/**
 * Получает общую статистику (только для админов)
 */
export const getStats = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		// Используем кэширование для получения статистики
		const stats = await withCache(
			async () => await AnalyticsService.getStats(),
			CACHE_KEYS.STATS,
			{ ttl: 300 }, // кэш на 5 минут
		);

		res.json({ ok: true, stats });
	} catch (error) {
		console.error('Ошибка при получении статистики:', error);
		res.status(500).json({ error: 'Ошибка при получении статистики' });
	}
};

/**
 * Получает детальную статистику (только для админов)
 */
export const getDetailedStats = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { days } = req.query;
		const daysNumber = days ? parseInt(days as string) : 7;

		console.log('Запрос детальной статистики на', daysNumber, 'дней');

		// Используем кэширование для получения детальной статистики
		const stats = await withCache(
			async () => await AnalyticsService.getDetailedStats(daysNumber),
			`${CACHE_KEYS.DETAILED_STATS}${daysNumber}`,
			{ ttl: 300 }, // кэш на 5 минут
		);

		console.log('Статистика получена успешно, отправляем ответ');

		res.json({ ok: true, stats });
	} catch (error) {
		console.error('Ошибка при получении детальной статистики:', error);
		res
			.status(500)
			.json({ error: 'Ошибка при получении детальной статистики' });
	}
};
