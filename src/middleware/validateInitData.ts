import { Request, Response, NextFunction } from 'express';
import { validate } from '@telegram-apps/init-data-node';
import { parseInitData } from '../utils/initDataUtils';
import { config } from '../config/env';

/**
 * Middleware для аутентификации через init data Telegram Mini App
 */
export function initDataAuth(req: Request, res: any, next: NextFunction) {
	const auth = req.header('Authorization') || '';

	if (!auth.startsWith('tma ')) {
		return res
			.status(401)
			.json({ error: 'Доступ запрещен. Необходимо авторизоваться' });
	}

	const initDataRaw = auth.slice(4);

	try {
		validate(initDataRaw, config.telegram.botToken);
		const initData = parseInitData(initDataRaw);

		req.body.telegramUser = initData.user;
		req.body.initData = initData;

		next();
	} catch (e: any) {
		return res.status(403).json({ error: e.message });
	}
}
