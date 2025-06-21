import { Response, NextFunction } from 'express';
import {
	TelegramRequest,
	ClubWithSignedUrl,
	PlayerWithSignedUrl,
} from '../types/api';
import { prisma } from '../prisma';
import { StorageService } from '../services/storage.service';

// Создаем экземпляр сервиса для хранилища
const storageService = new StorageService();

/**
 * Создание нового клуба (только для админа)
 */
export const createClub = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
) => {
	try {
		const { name } = req.body;
		const file = req.file;

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

		// Если файл не загружен, создаем клуб без логотипа
		if (!file) {
			const club = await prisma.club.create({
				data: {
					name,
					logo: '',
				},
			});

			res.status(201).json({
				ok: true,
				club: {
					id: club.id,
					name: club.name,
					logoUrl: '',
				},
			});
			return;
		}

		// Загружаем файл в R2 и получаем ключ файла
		const logoKey = await storageService.uploadFile(file, 'clubs');

		// Создаем клуб с ключом логотипа
		const club = await prisma.club.create({
			data: {
				name,
				logo: logoKey,
			},
		});

		// Генерируем подписанный URL для доступа к логотипу
		const logoUrl = club.logo
			? await storageService.getSignedUrl(club.logo)
			: '';

		res.status(201).json({
			ok: true,
			club: {
				id: club.id,
				name: club.name,
				logoUrl,
			},
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
		const clubs = await prisma.club.findMany({});

		// Генерируем подписанные URL и формируем ответ
		const formattedClubs = await Promise.all(
			clubs.map(async (club) => {
				// URL для логотипа
				const logoUrl = club.logo
					? await storageService.getSignedUrl(club.logo)
					: '';

				// Финальный формат клуба
				return {
					id: club.id,
					name: club.name,
					logoUrl,
				};
			}),
		);

		res.json({
			ok: true,
			clubs: formattedClubs,
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
			include: {
				players: true,
			},
		});

		if (!club) {
			res.status(404).json({ error: 'Клуб не найден' });
			return;
		}

		// URL для логотипа
		const logoUrl = club.logo
			? await storageService.getSignedUrl(club.logo)
			: '';

		// Игроки с аватарами
		const players = await Promise.all(
			club.players.map(async (player) => {
				const avatarUrl = player.avatar
					? await storageService.getSignedUrl(player.avatar)
					: '';
				return {
					id: player.id,
					name: player.name,
					avatarUrl,
				};
			}),
		);

		res.json({
			ok: true,
			club: {
				id: club.id,
				name: club.name,
				logoUrl,
				players,
			},
		});
	} catch (err: any) {
		console.error('Ошибка при получении клуба:', err);
		res.status(500).json({ error: 'Ошибка при получении клуба' });
	}
};

/**
 * Обновление информации о клубе (только для админа)
 */
export const updateClub = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
) => {
	try {
		const { id } = req.params;
		const { name } = req.body;
		const file = req.file;

		if (!id) {
			res.status(400).json({ error: 'ID клуба обязателен' });
			return;
		}

		// Проверяем существование клуба
		const club = await prisma.club.findUnique({
			where: {
				id,
			},
		});

		if (!club) {
			res.status(404).json({ error: 'Клуб не найден' });
			return;
		}

		let logoKey = club.logo;

		// Если загружен новый файл, обновляем логотип
		if (file) {
			// Если у клуба уже был логотип, удаляем старый файл
			if (club.logo) {
				try {
					await storageService.deleteFile(club.logo);
				} catch (error) {
					console.error('Ошибка при удалении старого логотипа:', error);
					// Продолжаем выполнение даже при ошибке удаления
				}
			}

			// Загружаем новый файл
			logoKey = await storageService.uploadFile(file, 'clubs');
		}

		// Обновляем данные клуба
		const updatedClub = await prisma.club.update({
			where: {
				id,
			},
			data: {
				name: name || club.name,
				logo: logoKey,
			},
		});

		// URL для логотипа
		const logoUrl = updatedClub.logo
			? await storageService.getSignedUrl(updatedClub.logo)
			: '';

		res.json({
			ok: true,
			club: {
				id: updatedClub.id,
				name: updatedClub.name,
				logoUrl,
			},
		});
	} catch (err: any) {
		console.error('Ошибка при обновлении клуба:', err);
		res.status(500).json({ error: 'Ошибка при обновлении клуба' });
	}
};

/**
 * Удаление клуба (только для админа)
 */
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

		// Проверяем существование клуба
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

		// Если у клуба есть игроки, запрещаем удаление
		if (club.players.length > 0) {
			res.status(400).json({
				error:
					'Невозможно удалить клуб с игроками. Сначала удалите всех игроков из клуба.',
			});
			return;
		}

		// Если у клуба был логотип, удаляем файл
		if (club.logo) {
			try {
				await storageService.deleteFile(club.logo);
			} catch (error) {
				console.error('Ошибка при удалении логотипа:', error);
				// Продолжаем выполнение даже при ошибке удаления файла
			}
		}

		// Удаляем клуб
		await prisma.club.delete({
			where: {
				id,
			},
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
