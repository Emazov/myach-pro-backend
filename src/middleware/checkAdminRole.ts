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

		console.log('checkAdminRole - telegramUser:', telegramUser);

		if (!telegramUser || !telegramUser.id) {
			console.error('checkAdminRole - пользователь не найден в req.body');
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

		console.log('checkAdminRole - найден пользователь:', user);

		if (!user || user.role !== 'admin') {
			console.error('checkAdminRole - пользователь не админ или не найден');
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
