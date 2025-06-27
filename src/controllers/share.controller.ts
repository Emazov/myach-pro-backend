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
import { logger } from '../utils/logger';

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
	public shareResults = async (req: Request, res: Response) => {
		let userId: number | undefined; // Определяем в начале для доступа в catch

		try {
			const { shareData, telegramUser } = req.body; // telegramUser из middleware

			// Детальное логирование для диагностики
			console.log('🔍 Диагностика shareResults:');
			console.log('📦 shareData присутствует:', !!shareData);
			console.log('👤 telegramUser из middleware:', telegramUser);
			console.log('🆔 telegramUser.id:', telegramUser?.id);
			console.log('📋 Headers Authorization:', req.headers.authorization);
			console.log('📋 req.body keys:', Object.keys(req.body));

			if (!shareData) {
				res.status(400).json({
					error: 'Отсутствуют данные для генерации изображения',
				});
				return;
			}

			if (!telegramUser || !telegramUser.id) {
				console.error('❌ Ошибка: пользователь не найден в middleware');
				console.error('📋 Полные заголовки:', req.headers);
				console.error('👤 Объект telegramUser:', telegramUser);
				console.error('📦 req.body:', req.body);

				res.status(400).json({
					error: 'Не удалось получить ID пользователя',
					debug: {
						hasTelegramUser: !!telegramUser,
						userId: telegramUser?.id,
						hasAuthHeader: !!req.headers.authorization,
						bodyKeys: Object.keys(req.body),
					},
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

			// Генерируем изображение с теми же настройками что и для iOS
			console.log('🎨 Генерация изображения для Android с высоким качеством');
			const { imageBuffer, club } =
				await imageGenerationService.generateResultsImage(imageData, {
					quality: 98, // Высокое качество как для iOS
					width: 550, // Оптимальная ширина для аватарок
					height: 800, // Оптимальная высота
					optimizeForSpeed: false, // ВАЖНО: отключаем оптимизацию для загрузки аватарок
				});

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
				// КРИТИЧЕСКАЯ ПРОВЕРКА: Убеждаемся что бот инициализирован
				if (!this.bot) {
					throw new Error('Telegram бот не инициализирован');
				}

				// Проверяем что userId определен
				if (!userId) {
					throw new Error('ID пользователя не определен');
				}

				console.log(
					`📤 Отправка изображения в Telegram для пользователя: ${userId}`,
				);
				console.log(`📝 Размер изображения: ${imageBuffer.length} байт`);
				console.log(`🤖 Бот инициализирован: ${!!this.bot}`);

				// Пытаемся отправить через Stream (рекомендуемый способ)
				const imageStream = new Readable({
					read() {},
				});
				imageStream.push(imageBuffer);
				imageStream.push(null);

				const result = await this.bot.sendPhoto(userId, imageStream, {
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

				console.log(
					`✅ Изображение успешно отправлено через Stream, message_id: ${result.message_id}`,
				);
			} catch (streamError) {
				console.error('❌ Ошибка отправки через Stream:', {
					error:
						streamError instanceof Error
							? streamError.message
							: String(streamError),
					userId,
					imageSize: imageBuffer.length,
				});

				console.warn('🔄 Пробуем отправить через временный файл...');

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
				console.log(`💾 Временный файл создан: ${tempFilePath}`);

				try {
					// Проверяем что userId определен перед отправкой через файл
					if (!userId) {
						throw new Error('ID пользователя не определен для отправки файла');
					}

					// Отправляем через файл
					const fileResult = await this.bot.sendPhoto(userId, tempFilePath, {
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

					console.log(
						`✅ Изображение успешно отправлено через файл, message_id: ${fileResult.message_id}`,
					);
				} finally {
					// Удаляем временный файл
					try {
						await fs.promises.unlink(tempFilePath);
						console.log(`🗑️ Временный файл удален: ${tempFilePath}`);
					} catch (unlinkError) {
						console.warn('⚠️ Не удалось удалить временный файл:', {
							file: tempFilePath,
							error:
								unlinkError instanceof Error
									? unlinkError.message
									: String(unlinkError),
						});
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
			console.error(
				'❌ Критическая ошибка при генерации и отправке изображения:',
				{
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					userId,
				},
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
				'Ошибка при генерации превью изображения:',
				error instanceof Error ? error.message : String(error),
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
						quality: 98, // Еще выше качество для аватарок
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

export const shareController = new ShareController();
