import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';

import { config } from './config/env';
import { TelegramBotService } from './bot/telegramBot';

import authRoutes from './routes/auth';
import clubsRoutes from './routes/clubs';
import playersRoutes from './routes/players';
import adminRoutes from './routes/admin';
import botRoutes from './routes/bot';
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
	app.use(bodyParser.json());
	app.use(
		cors({
			origin: config.cors.origins,
		}),
	);

	// Подключаем маршруты API
	app.use('/api/auth', authRoutes);
	app.use('/api/clubs', clubsRoutes);
	app.use('/api/players', playersRoutes);
	app.use('/api/admin', adminRoutes);
	app.use('/api/bot', botRoutes);

	// Подключаем обработчик ошибок
	app.use(errorHandler);

	// Инициализируем бота
	const botService = new TelegramBotService();

	// Запускаем сервер
	app.listen(config.port, () => {
		console.log(`Сервер запущен на порту ${config.port}`);
	});

	return {
		app,
		bot: botService,
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
