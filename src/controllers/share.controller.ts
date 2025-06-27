import { Request, Response } from 'express';
import {
	imageGenerationService,
	ShareImageData,
} from '../services/imageGeneration.service';
import { TelegramBotService } from '../bot/telegramBot';
import { simpleBotMessagingService } from '../services/simpleBotMessaging.service';
import { initDataUtils } from '../utils/initDataUtils';
import { config } from '../config/env';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

/**
 * Контроллер для обработки функций шаринга
 * ИСПРАВЛЕНИЕ: Использует глобальный экземпляр бота вместо создания нового
 */
export class ShareController {
	private botService: TelegramBotService;

	constructor(botService: TelegramBotService) {
		this.botService = botService;
	}

	/**
	 * Генерирует изображение результатов и отправляет в Telegram
	 */
	public shareResults = async (req: Request, res: Response) => {
		let userId: number | undefined; // Определяем в начале для доступа в catch

		try {
			const { shareData, telegramUser } = req.body; // telegramUser из middleware

			// Диагностика запроса (только в development)
			logger.debug(
				`ShareResults запрос: user ${telegramUser?.id}`,
				'IMAGE_GENERATION',
			);

			if (!shareData) {
				res.status(400).json({
					error: 'Отсутствуют данные для генерации изображения',
				});
				return;
			}

			if (!telegramUser || !telegramUser.id) {
				logger.error('Пользователь не найден в middleware', 'AUTH');

				res.status(400).json({
					error: 'Не удалось получить ID пользователя',
				});
				return;
			}

			userId = telegramUser.id;

			// Подготавливаем данные для генерации изображения
			const imageData: ShareImageData = {
				categorizedPlayerIds: shareData.categorizedPlayerIds,
				categories: shareData.categories,
				clubId: shareData.clubId,
			};

			// Генерируем изображение с оптимальными настройками
			const { imageBuffer, club } =
				await imageGenerationService.generateResultsImage(imageData, {
					quality: 90, // Высокое качество как для iOS
					width: 550, // Оптимальная ширина для аватарок
					height: 800, // Оптимальная высота
					optimizeForSpeed: false, // ВАЖНО: отключаем оптимизацию для загрузки аватарок
				});

			// Проверяем размер изображения
			const imageSizeMB = imageBuffer.length / (1024 * 1024);

			if (imageSizeMB > 10) {
				logger.warn(
					`Изображение слишком большое: ${imageSizeMB.toFixed(2)}MB`,
					'IMAGE_GENERATION',
				);
			}

			// Отправляем изображение пользователю в Telegram
			const caption = `🏆 ТИР-ЛИСТ "${club.name.toUpperCase()}"\n\n⚽ Создай свой и делись с друзьями в\n@${
				config.telegram.botUsername
			}`;

			try {
				// Проверяем что userId определен
				if (!userId) {
					throw new Error('ID пользователя не определен');
				}

				// Используем универсальный сервис отправки (работает в любом процессе)
				const success = await simpleBotMessagingService.sendImage(
					userId,
					imageBuffer,
					caption,
				);

				if (!success) {
					throw new Error('Не удалось отправить изображение');
				}

				// Логируем успешную отправку
				logger.imageSent(true, userId.toString(), imageBuffer.length);
			} catch (sendError) {
				// Логируем ошибку отправки
				logger.imageSent(false, userId?.toString());
				logger.error(
					'Ошибка отправки изображения',
					'TELEGRAM_BOT',
					sendError as Error,
				);

				// Если отправка не удалась, уведомляем пользователя
				throw new Error('Сервис временно недоступен. Попробуйте позже.');
			}

			// Закрываем веб-приложение
			res.json({
				success: true,
				message: 'Изображение успешно отправлено в чат',
				closeWebApp: true,
			});
		} catch (error) {
			logger.error(
				'Критическая ошибка при генерации и отправке изображения',
				'IMAGE_GENERATION',
				error as Error,
			);
			res.status(500).json({
				error: 'Произошла ошибка при обработке запроса',
			});
		}
	};

	/**
	 * Предварительный просмотр изображения (сжатое)
	 */
	public previewImage = async (req: Request, res: Response) => {
		try {
			const { categorizedPlayerIds, categories, clubId } = req.body;

			if (!categorizedPlayerIds || !categories || !clubId) {
				res.status(400).json({
					error: 'Отсутствуют обязательные параметры',
				});
				return;
			}

			const { imageBuffer } = await imageGenerationService.generateResultsImage(
				{
					categorizedPlayerIds,
					categories,
					clubId,
				},
				{ quality: 75, width: 550, height: 800 }, // Сжатое качество для превью
			);

			res.set({
				'Content-Type': 'image/jpeg',
				'Content-Length': imageBuffer.length.toString(),
				'Cache-Control': 'no-cache',
			});

			res.send(imageBuffer);
		} catch (error) {
			logger.error(
				'Ошибка при генерации превью изображения',
				'IMAGE_GENERATION',
				error as Error,
			);
			res.status(500).json({
				error: 'Не удалось сгенерировать изображение',
			});
		}
	};

	/**
	 * Изображение в высоком качестве для скачивания/шэринга
	 */
	public downloadImage = async (req: Request, res: Response) => {
		try {
			const { categorizedPlayerIds, categories, clubId } = req.body;

			if (!categorizedPlayerIds || !categories || !clubId) {
				res.status(400).json({
					error: 'Отсутствуют обязательные параметры',
				});
				return;
			}

			console.log(
				'🎨 Генерация изображения для скачивания с улучшенным качеством',
			);

			const { imageBuffer, club } =
				await imageGenerationService.generateResultsImage(
					{
						categorizedPlayerIds,
						categories,
						clubId,
					},
					{
						quality: 90, // Еще выше качество для аватарок
						width: 550, // Оптимальная ширина для аватарок
						height: 800, // Оптимальная высота
						optimizeForSpeed: false, // Отключаем оптимизацию для лучшего качества
					},
				);

			// ИСПРАВЛЕНИЕ: Формируем безопасное ASCII имя файла для HTTP заголовка
			const safeClubName = club.name
				.replace(/[а-яё]/gi, (char) => {
					// Транслитерация русских букв
					const map: { [key: string]: string } = {
						а: 'a',
						б: 'b',
						в: 'v',
						г: 'g',
						д: 'd',
						е: 'e',
						ё: 'e',
						ж: 'zh',
						з: 'z',
						и: 'i',
						й: 'y',
						к: 'k',
						л: 'l',
						м: 'm',
						н: 'n',
						о: 'o',
						п: 'p',
						р: 'r',
						с: 's',
						т: 't',
						у: 'u',
						ф: 'f',
						х: 'h',
						ц: 'c',
						ч: 'ch',
						ш: 'sh',
						щ: 'sch',
						ъ: '',
						ы: 'y',
						ь: '',
						э: 'e',
						ю: 'yu',
						я: 'ya',
					};
					return map[char.toLowerCase()] || char;
				})
				.replace(/[^a-zA-Z0-9\s]/g, '') // Оставляем только ASCII символы и пробелы
				.replace(/\s+/g, '-') // Заменяем пробелы на дефисы
				.toLowerCase()
				.substring(0, 30); // Ограничиваем длину

			const fileName = `tier-list-${safeClubName || 'club'}.jpg`;
			console.log(`📁 Безопасное имя файла: ${fileName}`);

			res.set({
				'Content-Type': 'image/jpeg',
				'Content-Length': imageBuffer.length.toString(),
				'Content-Disposition': `attachment; filename="${fileName}"`,
				'Cache-Control': 'private, max-age=3600', // Кэшируем на час
			});

			res.send(imageBuffer);
		} catch (error) {
			logger.error(
				'Ошибка при генерации изображения для скачивания:',
				error instanceof Error ? error.message : String(error),
			);
			res.status(500).json({
				error: 'Не удалось сгенерировать изображение',
			});
		}
	};
}

// ShareController будет создан в index.ts с передачей botService
