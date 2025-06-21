import { Response, NextFunction } from 'express';
import { TelegramRequest } from '../types/api';
import { prisma } from '../prisma';

/**
 * Создание нового клуба (только для админа)
 */
export const createClub = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
) => {
	try {
		const { name, logo } = req.body;

		if (!name) {
			res.status(400).json({ error: 'Название клуба обязательно' });
			return;
		}

		const isClubExists = await prisma.club.findFirst({
			where: {
				name,
			},
		});

		if (isClubExists) {
			res.status(400).json({ error: 'Клуб с таким названием уже существует' });
			return;
		}

		const club = await prisma.club.create({
			data: {
				name,
				logo: logo || '',
			},
		});

		res.status(201).json({
			ok: true,
			club,
		});
	} catch (err: any) {
		console.error('Ошибка при создании клуба:', err);
		res.status(500).json({ error: 'Ошибка при создании клуба' });
	}
};

/**
 * Получение списка всех клубов (доступно всем пользователям)
 */
export const getAllClubs = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
) => {
	try {
		const clubs = await prisma.club.findMany({
			select: {
				id: true,
				name: true,
				logo: true,
				players: {
					select: {
						id: true,
						name: true,
						avatar: true,
					},
				},
			},
		});

		res.json({
			ok: true,
			clubs,
		});
	} catch (err: any) {
		console.error('Ошибка при получении клубов:', err);
		res.status(500).json({ error: 'Ошибка при получении клубов' });
	}
};

/**
 * Получение информации о конкретном клубе по ID
 */
export const getClubById = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
) => {
	try {
		const { id } = req.params;

		if (!id) {
			res.status(400).json({ error: 'ID клуба обязателен' });
			return;
		}

		const club = await prisma.club.findUnique({
			where: {
				id,
			},
			select: {
				id: true,
				name: true,
				logo: true,
				players: {
					select: {
						id: true,
						name: true,
						avatar: true,
					},
				},
			},
		});

		if (!club) {
			res.status(404).json({ error: 'Клуб не найден' });
			return;
		}

		res.json({
			ok: true,
			club,
		});
	} catch (err: any) {
		console.error('Ошибка при получении клуба:', err);
		res.status(500).json({ error: 'Ошибка при получении клуба' });
	}
};

export const updateClub = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
) => {
	try {
		const { id } = req.params;
		const { name, logo } = req.body;

		if (!id) {
			res.status(400).json({ error: 'ID клуба обязателен' });
			return;
		}

		const club = await prisma.club.findUnique({
			where: {
				id,
			},
			include: {
				players: true,
			},
		});

		if (!club) {
			res.status(404).json({ error: 'Клуб не найден' });
			return;
		}

		const updatedClub = await prisma.club.update({
			where: { id },
			data: { name, logo },
		});

		res.json({
			ok: true,
			club: updatedClub,
		});
	} catch (err: any) {
		console.error('Ошибка при обновлении клуба:', err);
		res.status(500).json({ error: 'Ошибка при обновлении клуба' });
	}
};

export const deleteClub = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
) => {
	try {
		const { id } = req.params;

		if (!id) {
			res.status(400).json({ error: 'ID клуба обязателен' });
			return;
		}

		const club = await prisma.club.findUnique({
			where: {
				id,
			},
		});

		if (!club) {
			res.status(404).json({ error: 'Клуб не найден' });
			return;
		}

		await prisma.club.delete({
			where: { id },
		});

		res.json({
			ok: true,
			message: 'Клуб успешно удален',
		});
	} catch (err: any) {
		console.error('Ошибка при удалении клуба:', err);
		res.status(500).json({ error: 'Ошибка при удалении клуба' });
	}
};
