import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

import { config } from './config/env';
import { TelegramBotService } from './bot/telegramBot';
import { redisService } from './services/redis.service';
import { AnalyticsService } from './services/analytics.service';
import { AdminService } from './services/admin.service';
import { imageGenerationService } from './services/imageGeneration.service';
import { logger } from './utils/logger';

// Импортируем middleware производительности и сжатия
import { simpleCompression } from './middleware/compression';
import {
	requestTimer,
	httpCache,
	connectionOptimizer,
	simpleRateLimit,
} from './middleware/performance';

import authRoutes from './routes/auth';
import clubsRoutes from './routes/clubs';
import playersRoutes from './routes/players';
import adminRoutes from './routes/admin';
import analyticsRoutes from './routes/analytics';
import uploadRoutes from './routes/upload';
import shareRoutes from './routes/share';
import healthRoutes from './routes/health';
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

	// Подключаем middleware производительности
	app.use(requestTimer);
	app.use(connectionOptimizer);
	app.use(httpCache);
	app.use(simpleCompression);
	app.use(simpleRateLimit(500, 60000)); // 500 запросов в минуту

	// Логируем CORS конфигурацию для отладки
	logger.info(`CORS origins: ${JSON.stringify(config.cors.origins)}`, 'CORS');

	// Настраиваем middleware
	app.use(
		cors({
			origin: config.cors.origins,
			credentials: true,
			optionsSuccessStatus: 200,
			methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
			allowedHeaders: [
				'Origin',
				'X-Requested-With',
				'Content-Type',
				'Accept',
				'Authorization',
				'Cache-Control',
				'X-Response-Time',
			],
		}),
	);

	// Добавляем middleware для парсинга JSON
	app.use(express.json({ limit: '10mb' }));
	app.use(express.urlencoded({ extended: true, limit: '10mb' }));

	// Health check маршруты (без префикса /api для удобства мониторинга)
	app.use('/health', healthRoutes);

	// Подключаем маршруты API
	app.use('/api/auth', authRoutes);
	app.use('/api/clubs', clubsRoutes);
	app.use('/api/players', playersRoutes);
	app.use('/api/admin', adminRoutes);
	app.use('/api/analytics', analyticsRoutes);
	app.use('/api/upload', uploadRoutes);
	app.use('/api/share', shareRoutes);

	// Подключаем обработчик ошибок
	app.use(errorHandler);

	// Инициализируем бота
	const botService = new TelegramBotService();

	// Запускаем периодическую задачу для очистки старых игровых сессий (каждые 30 минут)
	const cleanupInterval = setInterval(async () => {
		try {
			const expiredCount = await AnalyticsService.expireOldSessions(24);
			if (expiredCount > 0) {
				logger.info(
					`Автоматически истекло ${expiredCount} старых игровых сессий`,
				);
			}
		} catch (error) {
			logger.error(
				'Ошибка при автоматической очистке старых сессий',
				'CLEANUP',
				error,
			);
		}
	}, 30 * 60 * 1000); // 30 минут

	// Очищаем интервал при выключении приложения
	process.on('SIGINT', async () => {
		logger.shutdown('Получен сигнал SIGINT, завершение работы...');
		clearInterval(cleanupInterval);
		await imageGenerationService.cleanup();
		process.exit(0);
	});

	process.on('SIGTERM', async () => {
		logger.shutdown('Получен сигнал SIGTERM, завершение работы...');
		clearInterval(cleanupInterval);
		await imageGenerationService.cleanup();
		process.exit(0);
	});

	// Запускаем сервер
	app.listen(config.port, async () => {
		logger.startup(`Сервер запущен на порту ${config.port}`);
		logger.info(
			'Периодическая очистка старых игровых сессий запущена (каждые 30 минут)',
		);

		// Проверяем изменение главного админа при запуске
		try {
			await AdminService.checkAndResetAdminsOnMainAdminChange();
		} catch (error) {
			logger.error('Ошибка при проверке главного админа', 'STARTUP', error);
		}

		// Инициализируем ресурсы для генерации изображений
		try {
			await imageGenerationService.initializeResources();
			logger.info('ImageGenerationService инициализирован');
		} catch (error) {
			logger.error(
				'Ошибка при инициализации ImageGenerationService',
				'STARTUP',
				error,
			);
		}
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
	logger.error('Критическая ошибка при запуске приложения', 'STARTUP', error);
	process.exit(1);
}
