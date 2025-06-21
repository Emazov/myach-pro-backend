import { Response, NextFunction } from 'express';
import { TelegramRequest, AuthResponse } from '../types/api';
import { config } from '../config/env';
import { prisma } from '../prisma';

/**
 * Контроллер для авторизации пользователя через Telegram
 */
export const authUser = async (
	req: TelegramRequest,
	res: Response<AuthResponse | { error: string }>,
	next: NextFunction,
) => {
	try {
		const { telegramUser } = req.body;

		if (!telegramUser) {
			res.status(400).json({ error: 'Данные пользователя не найдены' });
			return;
		}

		// Определяем роль пользователя (админ или обычный пользователь)
		const role =
			telegramUser.id === Number(config.telegram.adminId) ? 'admin' : 'user';

		const isUserExists = await prisma.user.findUnique({
			where: {
				telegramId: telegramUser.id.toString(),
			},
		});

		let user;

		if (!isUserExists) {
			// Создаем нового пользователя
			user = await prisma.user.create({
				data: {
					telegramId: telegramUser.id.toString(),
					username: telegramUser.username || null,
					role,
				},
			});
		} else {
			// Обновляем данные существующего пользователя
			user = await prisma.user.update({
				where: {
					telegramId: telegramUser.id.toString(),
				},
				data: {
					username: telegramUser.username || isUserExists.username,
					role, // обновляем роль на случай, если статус пользователя изменился
				},
			});
		}

		res.json({
			ok: true,
			role,
			user: {
				id: user.id,
				telegramId: user.telegramId,
				username: user.username || undefined,
			},
		});
	} catch (err: any) {
		console.error('Ошибка авторизации:', err);
		res.status(500).json({ error: 'Ошибка авторизации' });
	}
};
