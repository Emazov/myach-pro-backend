import { Response, NextFunction } from 'express';
import { TelegramRequest, PlayerWithSignedUrl } from '../types/api';
import { prisma } from '../prisma';
import { StorageService } from '../services/storage.service';
import { invalidateCache } from '../utils/cacheUtils';

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
	const startTime = Date.now();

	try {
		const { name, clubId } = req.body;
		const file = req.file;

		if (!name || !clubId) {
			res.status(400).json({ error: 'Имя и клуб обязательны' });
			return;
		}

		// ОПТИМИЗАЦИЯ 1: Объединяем проверки в один запрос
		const [club, existingPlayer] = await Promise.all([
			prisma.club.findUnique({
				where: { id: clubId },
				select: { id: true, name: true }, // Выбираем только нужные поля
			}),
			prisma.players.findFirst({
				where: { name, clubId },
				select: { id: true }, // Нужен только ID для проверки существования
			}),
		]);

		// Проверяем результаты
		if (!club) {
			res.status(400).json({ error: 'Указанный клуб не существует' });
			return;
		}

		if (existingPlayer) {
			res.status(400).json({
				error: 'Игрок с таким именем уже существует в данном клубе',
			});
			return;
		}

		// ОПТИМИЗАЦИЯ 2: Параллельная загрузка файла и создание игрока
		let avatarKey = '';
		let uploadPromise: Promise<string> | null = null;

		// Запускаем загрузку файла параллельно
		if (file) {
			uploadPromise = storageService.uploadFile(file, 'players');
		}

		// Создаем игрока с пустым аватаром сначала
		const player = await prisma.players.create({
			data: {
				name,
				avatar: '', // Временно пустой
				clubId,
			},
			select: {
				id: true,
				name: true,
			},
		});

		// ОПТИМИЗАЦИЯ 3: Параллельное выполнение загрузки и инвалидации
		const operations: Promise<any>[] = [];

		// Если файл загружается, ждем завершения и обновляем запись
		if (uploadPromise) {
			operations.push(
				uploadPromise.then(async (key) => {
					avatarKey = key;
					// Обновляем аватар игрока
					await prisma.players.update({
						where: { id: player.id },
						data: { avatar: key },
					});
					return key;
				}),
			);
		}

		// ОПТИМИЗАЦИЯ 4: Более быстрая инвалидация кэша
		operations.push(
			// Инвалидируем только конкретные ключи вместо поиска по шаблону
			Promise.all([
				invalidateCache(`cache:clubs:id:${clubId}`),
				invalidateCache('cache:clubs:all'),
			]),
		);

		// Ждем завершения всех операций
		await Promise.all(operations);

		// Генерируем URL для аватара если он есть
		const avatarUrl = avatarKey
			? await storageService.getFastImageUrl(avatarKey, 'avatar')
			: '';

		// Логируем производительность
		const duration = Date.now() - startTime;
		if (duration > 1000) {
			console.warn(`Медленное создание игрока: ${duration}ms`);
		}

		res.status(201).json({
			ok: true,
			player: {
				id: player.id,
				name: player.name,
				avatarUrl,
			},
		});
	} catch (err: any) {
		const duration = Date.now() - startTime;
		console.error(`Ошибка при создании игрока (${duration}ms):`, err);
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

		// Собираем все ключи аватаров для батч-обработки
		const avatarKeys = players
			.map((player) => player.avatar)
			.filter(Boolean) as string[];

		// Получаем все URL за один раз
		const avatarUrls = await storageService.getBatchFastUrls(
			avatarKeys,
			'avatar',
		);

		// Формируем ответ с предварительно полученными URL
		const formattedPlayers = players.map((player) => ({
			id: player.id,
			name: player.name,
			avatarUrl: player.avatar ? avatarUrls[player.avatar] || '' : '',
		}));

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
			? await storageService.getFastImageUrl(player.avatar, 'avatar')
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
		await Promise.all([
			invalidateCache(`cache:clubs:id:${updatedPlayer.clubId}`),
			invalidateCache('cache:clubs:all'),
		]);

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
		await Promise.all([
			invalidateCache(`cache:clubs:id:${player.clubId}`),
			invalidateCache('cache:clubs:all'),
		]);

		res.json({
			ok: true,
			message: 'Игрок успешно удален',
		});
	} catch (err: any) {
		console.error('Ошибка при удалении игрока:', err);
		res.status(500).json({ error: 'Ошибка при удалении игрока' });
	}
};
