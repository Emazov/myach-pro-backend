import { Response, NextFunction } from 'express';
import { TelegramRequest } from '../types/api';
import { AdminService } from '../services/admin.service';

/**
 * Получить список всех админов
 */
export const getAdmins = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const admins = await AdminService.getAdmins();
		res.json({ ok: true, admins });
	} catch (error) {
		console.error('Ошибка при получении списка админов:', error);
		res.status(500).json({ error: 'Ошибка сервера' });
	}
};

/**
 * Добавить нового админа
 */
export const addAdmin = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { telegramUser } = req.body;
		const { telegramId, username } = req.body;

		if (!telegramId) {
			res.status(400).json({ error: 'telegram_id обязателен' });
			return;
		}

		if (!telegramUser) {
			res.status(400).json({ error: 'Данные пользователя не найдены' });
			return;
		}

		const addedBy = telegramUser.id.toString();
		const result = await AdminService.addAdmin(
			telegramId,
			username || null,
			addedBy,
		);

		if (result.success) {
			res.json({ ok: true, message: result.message });
		} else {
			res.status(400).json({ error: result.message });
		}
	} catch (error) {
		console.error('Ошибка при добавлении админа:', error);
		res.status(500).json({ error: 'Ошибка сервера' });
	}
};

/**
 * Удалить админа
 */
export const removeAdmin = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { telegramUser } = req.body;
		const { telegramId } = req.params;

		if (!telegramId) {
			res.status(400).json({ error: 'telegram_id обязателен' });
			return;
		}

		if (!telegramUser) {
			res.status(400).json({ error: 'Данные пользователя не найдены' });
			return;
		}

		const removedBy = telegramUser.id.toString();
		const result = await AdminService.removeAdmin(telegramId, removedBy);

		if (result.success) {
			res.json({ ok: true, message: result.message });
		} else {
			res.status(400).json({ error: result.message });
		}
	} catch (error) {
		console.error('Ошибка при удалении админа:', error);
		res.status(500).json({ error: 'Ошибка сервера' });
	}
};
