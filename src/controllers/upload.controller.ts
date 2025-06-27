import { Response, NextFunction } from 'express';
import { TelegramRequest } from '../types/api';
import { StorageService } from '../services/storage.service';

const storageService = new StorageService();

/**
 * Генерирует presigned URL для прямой загрузки файла
 */
export const generateUploadUrl = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { fileName, contentType, folder } = req.body;

		if (!fileName || !contentType) {
			res.status(400).json({
				error: 'Имя файла и тип контента обязательны',
			});
			return;
		}

		// Проверяем тип файла
		const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

		if (!allowedTypes.includes(contentType)) {
			res.status(400).json({
				error: 'Неподдерживаемый тип файла',
			});
			return;
		}

		const { uploadUrl, fileKey } = await storageService.generateUploadUrl(
			fileName,
			contentType,
			folder || 'uploads',
		);

		res.json({
			ok: true,
			uploadUrl,
			fileKey,
		});
	} catch (error: any) {
		console.error('Ошибка генерации URL для загрузки:', error);
		res.status(500).json({
			error: 'Ошибка генерации ссылки для загрузки',
		});
	}
};

/**
 * Получает оптимизированные URL для множественных файлов
 */
export const getBatchImageUrls = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { fileKeys, width, height, format, quality } = req.body;

		if (!fileKeys || !Array.isArray(fileKeys)) {
			res.status(400).json({
				error: 'Список ключей файлов обязателен',
			});
			return;
		}

		const options = {
			width: width ? parseInt(width) : undefined,
			height: height ? parseInt(height) : undefined,
			format: format as 'webp' | 'jpeg' | 'png',
			quality: quality ? parseInt(quality) : undefined,
		};

		const urls = await storageService.getBatchUrls(fileKeys, options);

		res.json({
			ok: true,
			urls,
		});
	} catch (error: any) {
		console.error('Ошибка получения URL:', error);
		res.status(500).json({
			error: 'Ошибка получения ссылок на файлы',
		});
	}
};

/**
 * Получает статистику кэша изображений
 */
export const getCacheStats = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const stats = storageService.getCacheStats();

		res.json({
			ok: true,
			stats,
		});
	} catch (error: any) {
		console.error('Ошибка получения статистики кэша:', error);
		res.status(500).json({
			error: 'Ошибка получения статистики',
		});
	}
};

/**
 * Быстрое получение оптимизированных URL для изображений
 */
export const getFastImageUrls = async (
	req: TelegramRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { fileKeys, type = 'avatar' } = req.body;

		if (!fileKeys || !Array.isArray(fileKeys)) {
			res.status(400).json({
				error: 'Список ключей файлов обязателен',
			});
			return;
		}

		if (!['avatar', 'logo'].includes(type)) {
			res.status(400).json({
				error: 'Тип изображения должен быть avatar или logo',
			});
			return;
		}

		const urls = await storageService.getBatchFastUrls(
			fileKeys,
			type as 'avatar' | 'logo',
		);

		res.json({
			ok: true,
			urls,
		});
	} catch (error: any) {
		console.error('Ошибка получения быстрых URL:', error);
		res.status(500).json({
			error: 'Ошибка получения ссылок на файлы',
		});
	}
};
