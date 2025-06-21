import { Response, NextFunction } from 'express';
import { TelegramRequest } from '../types/api';
import { prisma } from '../prisma';

/**
 * Middleware для проверки прав администратора по роли в базе данных
 */
export const checkAdminRole = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
) => {
	try {
		const { telegramUser } = req.body;

		if (!telegramUser || !telegramUser.id) {
			return res.status(403).json({
				error: 'Доступ запрещен. Необходимо авторизоваться',
			});
		}

		// Проверяем роль пользователя в БД
		const user = await prisma.user.findUnique({
			where: {
				telegramId: telegramUser.id.toString(),
			},
		});

		if (!user || user.role !== 'admin') {
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
