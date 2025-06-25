import { Response, NextFunction } from 'express';
import { TelegramRequest, PlayerWithSignedUrl } from '../types/api';
import { prisma } from '../prisma';
import { StorageService } from '../services/storage.service';
import { invalidateClubsCache } from '../utils/cacheUtils';

// Создаем экземпляр сервиса для хранилища
const storageService = new StorageService();

// Константы для кэширования клубов (так как изменения игроков влияют на кэш клубов)
const CLUB_CACHE_KEYS = {
	ALL_CLUBS: 'cache:clubs:all',
	CLUB_BY_ID: 'cache:clubs:id:',
	CLUBS_WITH_PLAYERS: 'cache:clubs:with_players:',
};

/**
 * Создание нового игрока
 */
export const createPlayer = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { name, clubId } = req.body;
		const file = req.file;

		if (!name || !clubId) {
			res.status(400).json({ error: 'Имя и клуб обязательны' });
			return;
		}

		// Проверяем существование клуба
		const club = await prisma.club.findUnique({
			where: { id: clubId },
		});

		if (!club) {
			res.status(400).json({ error: 'Указанный клуб не существует' });
			return;
		}

		// Проверяем, существует ли игрок с таким именем
		const isPlayerExists = await prisma.players.findFirst({
			where: {
				name,
				clubId,
			},
		});

		if (isPlayerExists) {
			res
				.status(400)
				.json({ error: 'Игрок с таким именем уже существует в данном клубе' });
			return;
		}

		let avatarKey = '';

		// Если был загружен файл, сохраняем его в R2
		if (file) {
			avatarKey = await storageService.uploadFile(file, 'players');
		}

		// Создаем игрока
		const player = await prisma.players.create({
			data: {
				name,
				avatar: avatarKey,
				clubId,
			},
		});

		// Генерируем подписанный URL для аватара
		const avatarUrl = player.avatar
			? await storageService.getSignedUrl(player.avatar)
			: '';

		// Инвалидируем кэш клубов, так как добавился новый игрок
		await invalidateClubsCache();

		res.status(201).json({
			ok: true,
			player: {
				id: player.id,
				name: player.name,
				avatarUrl,
			},
		});
	} catch (err: any) {
		console.error('Ошибка при создании игрока:', err);
		res.status(500).json({ error: 'Ошибка при создании игрока' });
	}
};

/**
 * Получение списка всех игроков
 */
export const getAllPlayers = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const players = await prisma.players.findMany({
			include: {
				club: {
					select: {
						id: true,
						name: true,
					},
				},
			},
		});

		// Генерируем подписанные URL для всех аватаров
		const formattedPlayers = await Promise.all(
			players.map(async (player) => {
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
			players: formattedPlayers,
		});
	} catch (err: any) {
		console.error('Ошибка при получении игроков:', err);
		res.status(500).json({ error: 'Ошибка при получении игроков' });
	}
};

/**
 * Получение информации о конкретном игроке по ID
 */
export const getPlayerById = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
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
			include: {
				club: {
					select: {
						id: true,
						name: true,
					},
				},
			},
		});

		if (!player) {
			res.status(404).json({ error: 'Игрок не найден' });
			return;
		}

		// Генерируем подписанный URL для аватара
		const avatarUrl = player.avatar
			? await storageService.getSignedUrl(player.avatar)
			: '';

		res.json({
			ok: true,
			player: {
				id: player.id,
				name: player.name,
				avatarUrl,
				club: player.club
					? {
							id: player.club.id,
							name: player.club.name,
					  }
					: null,
			},
		});
	} catch (err: any) {
		console.error('Ошибка при получении игрока:', err);
		res.status(500).json({ error: 'Ошибка при получении игрока' });
	}
};

/**
 * Обновление информации об игроке
 */
export const updatePlayer = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { id } = req.params;
		const { name, clubId } = req.body;
		const file = req.file;

		if (!id) {
			res.status(400).json({ error: 'ID игрока обязателен' });
			return;
		}

		// Проверяем существование игрока
		const player = await prisma.players.findUnique({
			where: {
				id,
			},
		});

		if (!player) {
			res.status(404).json({ error: 'Игрок не найден' });
			return;
		}

		// Проверяем существование клуба, если указан
		if (clubId) {
			const club = await prisma.club.findUnique({
				where: { id: clubId },
			});

			if (!club) {
				res.status(400).json({ error: 'Указанный клуб не существует' });
				return;
			}
		}

		let avatarKey = player.avatar;

		// Если загружен новый аватар
		if (file) {
			// Удаляем старый аватар, если он был
			if (player.avatar) {
				try {
					await storageService.deleteFile(player.avatar);
				} catch (error) {
					console.error('Ошибка при удалении старого аватара:', error);
					// Продолжаем выполнение даже при ошибке удаления
				}
			}

			// Загружаем новый аватар
			avatarKey = await storageService.uploadFile(file, 'players');
		}

		// Обновляем данные игрока
		const updatedPlayer = await prisma.players.update({
			where: { id },
			data: {
				name: name || player.name,
				avatar: avatarKey,
				clubId: clubId || player.clubId,
			},
			include: {
				club: {
					select: {
						id: true,
						name: true,
					},
				},
			},
		});

		// Генерируем подписанный URL для аватара
		const avatarUrl = updatedPlayer.avatar
			? await storageService.getSignedUrl(updatedPlayer.avatar)
			: '';

		// Инвалидируем кэш клубов, так как изменился игрок
		await invalidateClubsCache();

		res.json({
			ok: true,
			player: {
				id: updatedPlayer.id,
				name: updatedPlayer.name,
				avatarUrl,
				club: updatedPlayer.club
					? {
							id: updatedPlayer.club.id,
							name: updatedPlayer.club.name,
					  }
					: null,
			},
		});
	} catch (err: any) {
		console.error('Ошибка при обновлении игрока:', err);
		res.status(500).json({ error: 'Ошибка при обновлении игрока' });
	}
};

/**
 * Удаление игрока
 */
export const deletePlayer = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { id } = req.params;

		if (!id) {
			res.status(400).json({ error: 'ID игрока обязателен' });
			return;
		}

		// Проверяем существование игрока
		const player = await prisma.players.findUnique({
			where: {
				id,
			},
		});

		if (!player) {
			res.status(404).json({ error: 'Игрок не найден' });
			return;
		}

		// Если у игрока был аватар, удаляем его
		if (player.avatar) {
			try {
				await storageService.deleteFile(player.avatar);
			} catch (error) {
				console.error('Ошибка при удалении аватара:', error);
				// Продолжаем выполнение даже при ошибке удаления файла
			}
		}

		// Удаляем игрока
		await prisma.players.delete({
			where: { id },
		});

		// Инвалидируем кэш клубов, так как удалился игрок
		await invalidateClubsCache();

		res.json({
			ok: true,
			message: 'Игрок успешно удален',
		});
	} catch (err: any) {
		console.error('Ошибка при удалении игрока:', err);
		res.status(500).json({ error: 'Ошибка при удалении игрока' });
	}
};
