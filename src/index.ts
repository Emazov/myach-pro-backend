import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

import { config } from './config/env';
import { TelegramBotService } from './bot/telegramBot';
import { redisService } from './services/redis.service';
import { AnalyticsService } from './services/analytics.service';

import authRoutes from './routes/auth';
import clubsRoutes from './routes/clubs';
import playersRoutes from './routes/players';
import adminRoutes from './routes/admin';
import analyticsRoutes from './routes/analytics';
import uploadRoutes from './routes/upload';
import { errorHandler } from './utils/errorHandler';

/**
 * Инициализация приложения
 */
const initApp = () => {
	// Создаем экземпляр Express
	const app = express();

	// Создаем директорию для временных файлов, если её нет
	const tmpDir = path.join(process.cwd(), 'tmp/uploads');
	if (!fs.existsSync(tmpDir)) {
		fs.mkdirSync(tmpDir, { recursive: true });
	}

	// Настраиваем middleware
	app.use(
		cors({
			origin: config.cors.origins,
		}),
	);

	// Добавляем middleware для парсинга JSON
	app.use(express.json({ limit: '10mb' }));
	app.use(express.urlencoded({ extended: true, limit: '10mb' }));

	// Подключаем маршруты API
	app.use('/api/auth', authRoutes);
	app.use('/api/clubs', clubsRoutes);
	app.use('/api/players', playersRoutes);
	app.use('/api/admin', adminRoutes);
	app.use('/api/analytics', analyticsRoutes);
	app.use('/api/upload', uploadRoutes);

	// Подключаем обработчик ошибок
	app.use(errorHandler);

	// Инициализируем бота
	const botService = new TelegramBotService();

	// Запускаем периодическую задачу для очистки старых игровых сессий (каждые 30 минут)
	const cleanupInterval = setInterval(async () => {
		try {
			const expiredCount = await AnalyticsService.expireOldSessions(24);
			if (expiredCount > 0) {
				console.log(
					`Автоматически истекло ${expiredCount} старых игровых сессий`,
				);
			}
		} catch (error) {
			console.error('Ошибка при автоматической очистке старых сессий:', error);
		}
	}, 30 * 60 * 1000); // 30 минут

	// Очищаем интервал при выключении приложения
	process.on('SIGINT', () => {
		console.log('Выключение приложения...');
		clearInterval(cleanupInterval);
		process.exit(0);
	});

	process.on('SIGTERM', () => {
		console.log('Выключение приложения...');
		clearInterval(cleanupInterval);
		process.exit(0);
	});

	// Запускаем сервер
	app.listen(config.port, () => {
		console.log(`Сервер запущен на порту ${config.port}`);
		console.log(
			'Периодическая очистка старых игровых сессий запущена (каждые 30 минут)',
		);
	});

	return {
		app,
		bot: botService,
		redis: redisService,
	};
};

/**
 * Запуск приложения
 */
try {
	initApp();
} catch (error) {
	console.error('Ошибка при запуске приложения:', error);
	process.exit(1);
}
