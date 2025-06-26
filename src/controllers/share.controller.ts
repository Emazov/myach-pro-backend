import { Request, Response } from 'express';
import {
	imageGenerationService,
	ShareImageData,
} from '../services/imageGeneration.service';
import TelegramBot from 'node-telegram-bot-api';
import { initDataUtils } from '../utils/initDataUtils';
import { config } from '../config/env';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';

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
			const { imageBuffer, club } =
				await imageGenerationService.generateResultsImage(imageData);

			// Проверяем размер изображения
			const imageSizeMB = imageBuffer.length / (1024 * 1024);
			console.log(
				`Размер сгенерированного изображения: ${imageSizeMB.toFixed(2)} MB`,
			);

			if (imageSizeMB > 10) {
				console.warn(
					'Изображение слишком большое, может возникнуть ошибка при отправке',
				);
			}

			// Отправляем изображение пользователю в Telegram
			const caption = `🏆 ТИР-ЛИСТ "${club.name.toUpperCase()}"\n\n⚽ Создано в @${
				config.telegram.botUsername
			}`;

			try {
				// Пытаемся отправить через Stream (рекомендуемый способ)
				const imageStream = new Readable({
					read() {},
				});
				imageStream.push(imageBuffer);
				imageStream.push(null);

				await this.bot.sendPhoto(userId, imageStream, {
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
			} catch (streamError) {
				console.warn(
					'Не удалось отправить через Stream, пробуем через временный файл',
				);

				// Fallback: создаем временный файл
				const tempFileName = `tier-list-${userId}-${Date.now()}.jpg`;
				const tempFilePath = path.join(
					process.cwd(),
					'tmp',
					'uploads',
					tempFileName,
				);

				// Записываем изображение во временный файл
				await fs.promises.writeFile(tempFilePath, imageBuffer);

				try {
					// Отправляем через файл
					await this.bot.sendPhoto(userId, tempFilePath, {
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
				} finally {
					// Удаляем временный файл
					try {
						await fs.promises.unlink(tempFilePath);
					} catch (unlinkError) {
						console.warn('Не удалось удалить временный файл:', unlinkError);
					}
				}
			}

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

			const { imageBuffer } = await imageGenerationService.generateResultsImage(
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
