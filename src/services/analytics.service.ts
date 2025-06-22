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
	 * Начинает новую игровую сессию
	 */
	static async startGameSession(
		telegramId: string,
		clubId: string,
	): Promise<string | null> {
		try {
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
	 * Завершает игровую сессию
	 */
	static async completeGameSession(telegramId: string): Promise<void> {
		try {
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
	 * Получает общую статистику
	 */
	static async getStats(): Promise<AnalyticsStats> {
		try {
			// Общее количество уникальных пользователей
			const totalUsers = await prisma.user.count();

			// Общее количество запусков приложения
			const totalAppStarts = await prisma.userEvent.count({
				where: { eventType: EventType.APP_START },
			});

			// Общее количество завершенных игр
			const totalGameCompletions = await prisma.gameSession.count({
				where: { isCompleted: true },
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
					createdAt: {
						gte: todayStart,
						lte: todayEnd,
					},
				},
			});

			const appStartsToday = await prisma.userEvent.count({
				where: {
					eventType: EventType.APP_START,
					createdAt: {
						gte: todayStart,
						lte: todayEnd,
					},
				},
			});

			const gameCompletionsToday = await prisma.gameSession.count({
				where: {
					isCompleted: true,
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
	 * Получает детальную статистику по периодам
	 */
	static async getDetailedStats(days: number = 7): Promise<any> {
		try {
			const endDate = new Date();
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - days);

			// Статистика по дням
			const dailyStatsRaw = await prisma.$queryRaw`
				SELECT 
					DATE(created_at) as date,
					COUNT(CASE WHEN event_type = 'app_start' THEN 1 END) as app_starts,
					COUNT(CASE WHEN event_type = 'game_completed' THEN 1 END) as game_completions
				FROM user_events 
				WHERE created_at >= ${startDate} AND created_at <= ${endDate}
				GROUP BY DATE(created_at)
				ORDER BY DATE(created_at) DESC
			`;

			// Преобразуем BigInt в Number и обрабатываем даты
			const dailyStats = convertBigIntToNumber(dailyStatsRaw);

			// Топ клубов по количеству игр
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
}
