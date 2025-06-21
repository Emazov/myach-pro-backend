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
): Promise<void> => {
	try {
		const { telegramUser } = req.body;

		if (!telegramUser || !telegramUser.id) {
			res.status(403).json({
				error: 'Доступ запрещен. Необходимо авторизоваться',
			});
			return;
		}

		// Проверяем роль пользователя в БД
		const user = await prisma.user.findUnique({
			where: {
				telegramId: telegramUser.id.toString(),
			},
		});

		if (!user || user.role !== 'admin') {
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
