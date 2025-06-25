import { Request, Response, NextFunction } from 'express';
import { validate } from '@telegram-apps/init-data-node';
import { parseInitData } from '../utils/initDataUtils';
import { config } from '../config/env';

/**
 * Middleware для аутентификации через init data Telegram Mini App
 */
export function initDataAuth(
	req: Request,
	res: Response,
	next: NextFunction,
): void {
	try {
		const auth = req.header('Authorization') || '';

		console.log('Authorization header:', auth ? 'Присутствует' : 'Отсутствует');
		console.log('Request URL:', req.url);
		console.log('Request method:', req.method);

		if (!auth || !auth.startsWith('tma ')) {
			console.error(
				'Ошибка авторизации: отсутствует или неверный заголовок Authorization',
			);
			res
				.status(401)
				.json({ error: 'Доступ запрещен. Необходимо авторизоваться' });
			return;
		}

		const initDataRaw = auth.slice(4);

		// Инициализируем body, если он не определен
		if (!req.body) {
			req.body = {};
		}

		// Валидируем данные от Telegram
		validate(initDataRaw, config.telegram.botToken);

		// Парсим данные
		const initData = parseInitData(initDataRaw);

		if (!initData || !initData.user) {
			console.error(
				'Ошибка авторизации: некорректные данные пользователя в initData',
			);
			res.status(400).json({ error: 'Некорректные данные пользователя' });
			return;
		}

		// Добавляем данные пользователя и initData в request
		req.body.telegramUser = initData.user;
		req.body.initData = initData;

		console.log('Успешная авторизация пользователя:', initData.user.id);
		next();
	} catch (e: any) {
		console.error('Ошибка обработки initData:', e);
		res.status(403).json({ error: e.message || 'Ошибка авторизации' });
	}
}

/**
 * Middleware для валидации initData из body или query параметров
 */
export function validateInitData(
	req: Request,
	res: Response,
	next: NextFunction,
): void {
	try {
		console.log('validateInitData - Request URL:', req.url);
		console.log('validateInitData - Request method:', req.method);
		console.log('validateInitData - Body keys:', Object.keys(req.body || {}));
		console.log('validateInitData - Query keys:', Object.keys(req.query || {}));

		// Получаем initData из body или query параметров
		const initDataRaw = req.body?.initData || (req.query?.initData as string);

		if (!initDataRaw) {
			console.error(
				'validateInitData - Ошибка авторизации: отсутствует initData',
			);
			console.log('validateInitData - Body:', req.body);
			console.log('validateInitData - Query:', req.query);
			res
				.status(401)
				.json({ error: 'Доступ запрещен. Необходимо авторизоваться' });
			return;
		}

		// Инициализируем body, если он не определен
		if (!req.body) {
			req.body = {};
		}

		// Валидируем данные от Telegram
		validate(initDataRaw, config.telegram.botToken);

		// Парсим данные
		const initData = parseInitData(initDataRaw);

		if (!initData || !initData.user) {
			console.error(
				'Ошибка авторизации: некорректные данные пользователя в initData',
			);
			res.status(400).json({ error: 'Некорректные данные пользователя' });
			return;
		}

		// Добавляем данные пользователя и initData в request
		req.body.telegramUser = initData.user;
		req.body.initData = initData;

		console.log('Успешная авторизация пользователя:', initData.user.id);
		next();
	} catch (e: any) {
		console.error('Ошибка обработки initData:', e);
		res.status(403).json({ error: e.message || 'Ошибка авторизации' });
	}
}
