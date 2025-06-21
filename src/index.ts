import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

import { config } from './config/env';
import { TelegramBotService } from './bot/telegramBot';

import authRoutes from './routes/auth';
import clubsRoutes from './routes/clubs';
import playersRoutes from './routes/players';
import { errorHandler } from './utils/errorHandler';
import { initDataAuth } from './middleware/validateInitData';

const initApp = () => {
	const app = express();

	app.use(bodyParser.json());
	app.use(
		cors({
			origin: config.cors.origins,
		}),
	);

	app.use('/api/auth', initDataAuth, authRoutes);
	app.use('/api/clubs', initDataAuth, clubsRoutes);
	app.use('/api/players', initDataAuth, playersRoutes);

	app.use(errorHandler);

	const botService = new TelegramBotService();

	app.listen(config.port, () => {
		console.log(`Сервер запущен на порту ${config.port}`);
	});

	return {
		app,
		bot: botService,
	};
};

try {
	initApp();
} catch (error) {
	console.error('Ошибка при запуске приложения:', error);
	process.exit(1);
}
