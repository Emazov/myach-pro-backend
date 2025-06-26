import { Request, Response } from 'express';
import {
	imageGenerationService,
	ShareImageData,
} from '../services/imageGeneration.service';
import TelegramBot from 'node-telegram-bot-api';
import { initDataUtils } from '../utils/initDataUtils';
import { config } from '../config/env';

/**
 * Контроллер для обработки функций шаринга
 */
export class ShareController {
	private bot: TelegramBot;

	constructor() {
		this.bot = new TelegramBot(config.telegram.botToken);
	}

	/**
	 * Генерирует изображение результатов и отправляет в Telegram
	 */
	public shareResults = async (req: Request, res: Response): Promise<void> => {
		try {
			const { initData, shareData } = req.body;

			if (!initData || !shareData) {
				res.status(400).json({
					error: 'Отсутствуют необходимые данные',
				});
				return;
			}

			// Валидируем initData
			const validationResult = initDataUtils.validate(
				initData,
				config.telegram.botToken,
			);
			if (!validationResult.isValid) {
				res.status(401).json({
					error: 'Недействительные данные пользователя',
				});
				return;
			}

			const parsedData = initDataUtils.parse(initData);
			const userId = parsedData.user?.id;

			if (!userId) {
				res.status(400).json({
					error: 'Не удалось получить ID пользователя',
				});
				return;
			}

			// Подготавливаем данные для генерации изображения
			const imageData: ShareImageData = {
				categorizedPlayerIds: shareData.categorizedPlayerIds,
				categories: shareData.categories,
				clubId: shareData.clubId,
			};

			// Генерируем изображение
			const imageBuffer = await imageGenerationService.generateResultsImage(
				imageData,
			);

			// Отправляем изображение пользователю в Telegram
			const caption = `🏆 ТИР-ЛИСТ "${shareData.clubName.toUpperCase()}"\n\n⚽ Создано в @${
				config.telegram.botUsername
			}`;

			await this.bot.sendPhoto(userId, imageBuffer, {
				caption,
				reply_markup: {
					inline_keyboard: [
						[
							{
								text: 'Открыть Тир Лист',
								web_app: { url: config.webApp.url },
							},
						],
					],
				},
			});

			// Закрываем веб-приложение
			res.json({
				success: true,
				message: 'Изображение успешно отправлено в чат',
				closeWebApp: true,
			});
		} catch (error) {
			console.error('Ошибка при генерации и отправке изображения:', error);
			res.status(500).json({
				error: 'Произошла ошибка при обработке запроса',
			});
		}
	};

	/**
	 * Предварительный просмотр изображения (для тестирования)
	 */
	public previewImage = async (req: Request, res: Response): Promise<void> => {
		try {
			const shareData = req.body;

			if (!shareData) {
				res.status(400).json({
					error: 'Отсутствуют данные для генерации изображения',
				});
				return;
			}

			const imageData: ShareImageData = {
				categorizedPlayerIds: shareData.categorizedPlayerIds,
				categories: shareData.categories,
				clubId: shareData.clubId,
			};

			const imageBuffer = await imageGenerationService.generateResultsImage(
				imageData,
			);

			res.set('Content-Type', 'image/jpeg');
			res.send(imageBuffer);
		} catch (error) {
			console.error('Ошибка при генерации изображения:', error);
			res.status(500).json({
				error: 'Произошла ошибка при генерации изображения',
			});
		}
	};
}

export const shareController = new ShareController();
