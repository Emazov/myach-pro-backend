import { NextFunction } from 'express';
import { TelegramRequest } from '../types/api';
import { config } from '../config/env';

/**
 * Middleware для проверки прав администратора
 */
export const checkAdminRole = (
	req: TelegramRequest,
	res: any,
	next: NextFunction,
) => {
	try {
		const { id } = req.body.telegramUser;

		if (id !== Number(config.telegram.adminId)) {
			return res.status(403).json({
				error: 'Доступ запрещен. Недостаточно прав',
			});
		}

		next();
	} catch (err) {
		console.error('Ошибка проверки прав доступа:', err);
		res.status(500).json({ error: 'Внутренняя ошибка сервера' });
	}
};
