import { Response, NextFunction } from 'express';
import { TelegramRequest } from '../types/api';
import { prisma } from '../prisma';

export const createPlayer = async (req: TelegramRequest, res: Response) => {
	try {
		const { name, avatar, clubId } = req.body;

		if (!name || !avatar || !clubId) {
			res.status(400).json({ error: 'Имя, аватар и клуб обязательны' });
			return;
		}

		const isPlayerExists = await prisma.players.findFirst({
			where: {
				name,
			},
		});

		if (isPlayerExists) {
			res.status(400).json({ error: 'Игрок с таким именем уже существует' });
			return;
		}

		const player = await prisma.players.create({
			data: {
				name,
				avatar: avatar || '',
				clubId,
			},
		});

		res.status(201).json({
			ok: true,
			player,
		});
	} catch (err: any) {
		console.error('Ошибка при создании клуба:', err);
		res.status(500).json({ error: 'Ошибка при создании клуба' });
	}
};

export const getAllPlayers = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
) => {
	try {
		const players = await prisma.players.findMany({
			select: {
				id: true,
				name: true,
				avatar: true,
			},
		});

		res.json({
			ok: true,
			players,
		});
	} catch (err: any) {
		console.error('Ошибка при получении игроков:', err);
		res.status(500).json({ error: 'Ошибка при получении игроков' });
	}
};

/**
 * Получение информации о конкретном клубе по ID
 */
export const getPlayerById = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
) => {
	try {
		const { id } = req.params;

		if (!id) {
			res.status(400).json({ error: 'ID игрока обязателен' });
			return;
		}

		const player = await prisma.players.findUnique({
			where: {
				id,
			},
			select: {
				id: true,
				name: true,
				avatar: true,
			},
		});

		if (!player) {
			res.status(404).json({ error: 'Игрок не найден' });
			return;
		}

		res.json({
			ok: true,	
			player,
		});
	} catch (err: any) {
		console.error('Ошибка при получении игрока:', err);
		res.status(500).json({ error: 'Ошибка при получении игрока' });
	}
};

export const updatePlayer = async (
	req: TelegramRequest,	
	res: Response,
	next: NextFunction,
) => {
	try {
		const { id } = req.params;
		const { name, avatar } = req.body;

		if (!id) {
			res.status(400).json({ error: 'ID игрока обязателен' });
			return;
		}

		const player = await prisma.players.findUnique({
			where: {
				id,
			},
		});

		if (!player) {
			res.status(404).json({ error: 'Игрок не найден' });
			return;
		}

		const updatedPlayer = await prisma.players.update({
			where: { id },
			data: { name, avatar },
		});

		res.json({
			ok: true,
			player: updatedPlayer,
		});
	} catch (err: any) {
		console.error('Ошибка при обновлении игрока:', err);
		res.status(500).json({ error: 'Ошибка при обновлении игрока' });
	}
};

export const deletePlayer = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
) => {
	try {
		const { id } = req.params;

		if (!id) {
			res.status(400).json({ error: 'ID игрока обязателен' });
			return;
		}

		const player = await prisma.players.findUnique({
			where: {
				id,
			},
		});

		if (!player) {
			res.status(404).json({ error: 'Игрок не найден' });
			return;
		}

		await prisma.players.delete({
			where: { id },
		});

		res.json({
			ok: true,
			message: 'Игрок успешно удален',
		});
	} catch (err: any) {
		console.error('Ошибка при удалении игрока:', err);
		res.status(500).json({ error: 'Ошибка при удалении игрока' });
	}
};
