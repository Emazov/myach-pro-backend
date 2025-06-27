import express from 'express';
import { validateInitData } from '../middleware/validateInitData';
import { ShareController } from '../controllers/share.controller';
import { createRateLimit } from '../middleware/advancedRateLimit';
import { TelegramBotService } from '../bot/telegramBot';

/**
 * Создает роуты для шеринга с переданным экземпляром бота
 */
export const createShareRoutes = (botService: TelegramBotService) => {
	const router = express.Router();
	const shareController = new ShareController(botService);

	// Создаем лимиты для генерации изображений
	const imageRateLimit = createRateLimit.imageGeneration().middleware();

	/**
	 * POST /api/share/results
	 * Генерирует изображение результатов и отправляет в Telegram
	 */
	router.post(
		'/results',
		validateInitData,
		createRateLimit.shareResults().middleware(), // Строгий лимит для отправки в чат
		imageRateLimit, // Общий лимит для генерации изображений
		shareController.shareResults,
	);

	/**
	 * POST /api/share/preview
	 * Предварительный просмотр изображения (сжатое для быстрой загрузки)
	 */
	router.post(
		'/preview',
		validateInitData,
		imageRateLimit,
		shareController.previewImage,
	);

	/**
	 * POST /api/share/download
	 * Получение изображения в высоком качестве для шэринга/скачивания
	 */
	router.post(
		'/download',
		validateInitData,
		imageRateLimit,
		shareController.downloadImage,
	);

	return router;
};
