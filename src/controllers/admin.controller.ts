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

/**
 * Поиск пользователей по username
 */
export const searchUsers = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { telegramUser } = req.body;
		const { query } = req.query;

		if (!query || typeof query !== 'string') {
			res.status(400).json({ error: 'Параметр query обязателен' });
			return;
		}

		if (!telegramUser) {
			res.status(400).json({ error: 'Данные пользователя не найдены' });
			return;
		}

		const requestedBy = telegramUser.id.toString();
		const result = await AdminService.searchUsersByUsername(query, requestedBy);

		if (result.success) {
			res.json({ ok: true, users: result.users });
		} else {
			res.status(400).json({ error: result.message });
		}
	} catch (error) {
		console.error('Ошибка при поиске пользователей:', error);
		res.status(500).json({ error: 'Ошибка сервера' });
	}
};

/**
 * Добавить админа по username
 */
export const addAdminByUsername = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { telegramUser } = req.body;
		const { username } = req.body;

		if (!username) {
			res.status(400).json({ error: 'username обязателен' });
			return;
		}

		if (!telegramUser) {
			res.status(400).json({ error: 'Данные пользователя не найдены' });
			return;
		}

		const addedBy = telegramUser.id.toString();
		const result = await AdminService.addAdminByUsername(username, addedBy);

		if (result.success) {
			res.json({ ok: true, message: result.message });
		} else {
			res.status(400).json({ error: result.message });
		}
	} catch (error) {
		console.error('Ошибка при добавлении админа по username:', error);
		res.status(500).json({ error: 'Ошибка сервера' });
	}
};
