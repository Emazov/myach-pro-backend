import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

import { config } from './config/env';
import { TelegramBotService } from './bot/telegramBot';
import authRoutes from './routes/auth';
import clubsRoutes from './routes/clubs';
import { errorHandler } from './utils/errorHandler';

/**
 * Инициализация приложения
 */
const initApp = () => {
	// Создаем экземпляр Express
	const app = express();

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
