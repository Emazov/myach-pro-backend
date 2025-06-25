import { prisma } from '../prisma';
import { convertBigIntToNumber } from '../utils/bigintUtils';

export enum EventType {
	APP_START = 'app_start',
	GAME_START = 'game_start',
	GAME_COMPLETED = 'game_completed',
}

export interface AnalyticsStats {
	totalUsers: number;
	totalAppStarts: number;
	totalGameCompletions: number;
	conversionRate: number;
	recentStats: {
		usersToday: number;
		appStartsToday: number;
		gameCompletionsToday: number;
	};
}

export class AnalyticsService {
	/**
	 * Логирует событие пользователя (исключая админов)
	 */
	static async logEvent(
		telegramId: string,
		eventType: EventType,
		metadata?: any,
	): Promise<void> {
		try {
			// Проверяем роль пользователя - не логируем события от админов
			const user = await prisma.user.findUnique({
				where: { telegramId },
				select: { role: true },
			});

			if (user?.role === 'admin') {
				console.log(
					`Пропускаем логирование события ${eventType} для админа ${telegramId}`,
				);
				return;
			}

			await prisma.userEvent.create({
				data: {
					telegramId,
					eventType,
					metadata: metadata || {},
				},
			});
		} catch (error) {
			console.error('Ошибка при логировании события:', error);
			// Не прерываем основной поток при ошибке аналитики
		}
	}

	/**
	 * Начинает новую игровую сессию (исключая админов)
	 */
	static async startGameSession(
		telegramId: string,
		clubId: string,
	): Promise<string | null> {
		try {
			// Проверяем роль пользователя - не создаем сессии для админов
			const user = await prisma.user.findUnique({
				where: { telegramId },
				select: { role: true },
			});

			if (user?.role === 'admin') {
				console.log(
					`Пропускаем создание игровой сессии для админа ${telegramId}`,
				);
				return null;
			}

			// Проверяем, есть ли уже активная сессия
			const activeSession = await prisma.gameSession.findFirst({
				where: {
					telegramId,
					isCompleted: false,
				},
			});

			if (activeSession) {
				// Завершаем предыдущую сессию, если она была
				await prisma.gameSession.update({
					where: { id: activeSession.id },
					data: {
						isCompleted: true,
						completedAt: new Date(),
					},
				});
			}

			// Создаем новую сессию
			const session = await prisma.gameSession.create({
				data: {
					telegramId,
					clubId,
				},
			});

			return session.id;
		} catch (error) {
			console.error('Ошибка при создании игровой сессии:', error);
			return null;
		}
	}

	/**
	 * Завершает игровую сессию (исключая админов)
	 */
	static async completeGameSession(telegramId: string): Promise<void> {
		try {
			// Проверяем роль пользователя - не завершаем сессии для админов
			const user = await prisma.user.findUnique({
				where: { telegramId },
				select: { role: true },
			});

			if (user?.role === 'admin') {
				console.log(
					`Пропускаем завершение игровой сессии для админа ${telegramId}`,
				);
				return;
			}

			// Находим активную сессию пользователя
			const activeSession = await prisma.gameSession.findFirst({
				where: {
					telegramId,
					isCompleted: false,
				},
			});

			if (activeSession) {
				await prisma.gameSession.update({
					where: { id: activeSession.id },
					data: {
						isCompleted: true,
						completedAt: new Date(),
					},
				});
			}
		} catch (error) {
			console.error('Ошибка при завершении игровой сессии:', error);
		}
	}

	/**
	 * Получает общую статистику (исключая админов)
	 */
	static async getStats(): Promise<AnalyticsStats> {
		try {
			// Общее количество уникальных пользователей (без админов)
			const totalUsers = await prisma.user.count({
				where: { role: 'user' },
			});

			// Общее количество запусков приложения (от обычных пользователей)
			const totalAppStarts = await prisma.userEvent.count({
				where: {
					eventType: EventType.APP_START,
					// Исключаем админов через join с таблицей users
					User: {
						role: 'user',
					},
				},
			});

			// Общее количество завершенных игр (от обычных пользователей)
			const totalGameCompletions = await prisma.gameSession.count({
				where: {
					isCompleted: true,
					// Исключаем админов через join с таблицей users
					User: {
						role: 'user',
					},
				},
			});

			// Конверсия
			const conversionRate =
				totalAppStarts > 0 ? (totalGameCompletions / totalAppStarts) * 100 : 0;

			// Статистика за сегодня
			const todayStart = new Date();
			todayStart.setHours(0, 0, 0, 0);
			const todayEnd = new Date();
			todayEnd.setHours(23, 59, 59, 999);

			const usersToday = await prisma.user.count({
				where: {
					role: 'user',
					createdAt: {
						gte: todayStart,
						lte: todayEnd,
					},
				},
			});

			const appStartsToday = await prisma.userEvent.count({
				where: {
					eventType: EventType.APP_START,
					User: {
						role: 'user',
					},
					createdAt: {
						gte: todayStart,
						lte: todayEnd,
					},
				},
			});

			const gameCompletionsToday = await prisma.gameSession.count({
				where: {
					isCompleted: true,
					User: {
						role: 'user',
					},
					completedAt: {
						gte: todayStart,
						lte: todayEnd,
					},
				},
			});

			// Преобразуем все BigInt значения в Number
			const result = {
				totalUsers,
				totalAppStarts,
				totalGameCompletions,
				conversionRate: Math.round(conversionRate * 100) / 100,
				recentStats: {
					usersToday,
					appStartsToday,
					gameCompletionsToday,
				},
			};

			return convertBigIntToNumber(result);
		} catch (error) {
			console.error('Ошибка при получении статистики:', error);
			throw new Error('Ошибка при получении статистики');
		}
	}

	/**
	 * Получает детальную статистику по периодам (исключая админов)
	 */
	static async getDetailedStats(days: number = 7): Promise<any> {
		try {
			const endDate = new Date();
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - days);

			// Статистика по дням (исключая админов)
			const dailyStatsRaw = await prisma.$queryRaw`
				SELECT 
					DATE(ue.created_at) as date,
					COUNT(CASE WHEN ue.event_type = 'app_start' THEN 1 END) as app_starts,
					COUNT(CASE WHEN ue.event_type = 'game_completed' THEN 1 END) as game_completions
				FROM user_events ue
				INNER JOIN users u ON ue.telegram_id = u.telegram_id
				WHERE ue.created_at >= ${startDate} 
					AND ue.created_at <= ${endDate}
					AND u.role = 'user'
				GROUP BY DATE(ue.created_at)
				ORDER BY DATE(ue.created_at) DESC
			`;

			// Преобразуем BigInt в Number и обрабатываем даты
			const dailyStats = convertBigIntToNumber(dailyStatsRaw);

			// Топ клубов по количеству игр (исключая админов)
			const topClubsRaw = await prisma.gameSession.groupBy({
				by: ['clubId'],
				where: {
					isCompleted: true,
					clubId: {
						not: null, // Исключаем сессии с удаленными клубами
					},
					completedAt: {
						gte: startDate,
						lte: endDate,
					},
					// Исключаем админов
					User: {
						role: 'user',
					},
				},
				_count: {
					id: true,
				},
				orderBy: {
					_count: {
						id: 'desc',
					},
				},
				take: 5,
			});

			// Преобразуем BigInt в Number для топ клубов
			const topClubs = convertBigIntToNumber(topClubsRaw);

			// Получаем названия клубов
			const clubIds = topClubs.map((club: any) => club.clubId).filter(Boolean);
			const clubs = await prisma.club.findMany({
				where: {
					id: {
						in: clubIds as string[],
					},
				},
				select: {
					id: true,
					name: true,
				},
			});

			const topClubsWithNames = topClubs.map((stat: any) => ({
				clubId: stat.clubId,
				clubName:
					clubs.find((club) => club.id === stat.clubId)?.name ||
					'Неизвестный клуб',
				gameCount: stat._count.id,
			}));

			return {
				dailyStats,
				topClubs: topClubsWithNames,
			};
		} catch (error) {
			console.error('Ошибка при получении детальной статистики:', error);
			throw new Error('Ошибка при получении детальной статистики');
		}
	}

	/**
	 * Сбрасывает всю аналитику (только для суперадминов)
	 * Очищает таблицы user_events, game_sessions и удаляет обычных пользователей
	 */
	static async resetAnalytics(): Promise<{
		deletedUserEvents: number;
		deletedGameSessions: number;
		deletedUsers: number;
	}> {
		try {
			console.log('Начинаем сброс аналитики...');

			// Подсчитываем количество записей перед удалением для отчета
			const userEventsCount = await prisma.userEvent.count();
			const gameSessionsCount = await prisma.gameSession.count();
			const usersCount = await prisma.user.count({
				where: { role: 'user' },
			});

			console.log(
				`Найдено записей для удаления: ${userEventsCount} событий, ${gameSessionsCount} сессий, ${usersCount} пользователей`,
			);

			// Выполняем операции удаления в транзакции
			const result = await prisma.$transaction(async (tx) => {
				// 1. Удаляем все события пользователей
				await tx.userEvent.deleteMany({});
				console.log('Все события пользователей удалены');

				// 2. Удаляем все игровые сессии
				await tx.gameSession.deleteMany({});
				console.log('Все игровые сессии удалены');

				// 3. Удаляем всех обычных пользователей (сохраняем только админов)
				await tx.user.deleteMany({
					where: {
						role: 'user',
					},
				});
				console.log('Все обычные пользователи удалены');

				return {
					deletedUserEvents: userEventsCount,
					deletedGameSessions: gameSessionsCount,
					deletedUsers: usersCount,
				};
			});

			console.log('Сброс аналитики завершен успешно');
			return result;
		} catch (error) {
			console.error('Ошибка при сбросе аналитики:', error);
			throw new Error('Ошибка при сбросе аналитики');
		}
	}
}
