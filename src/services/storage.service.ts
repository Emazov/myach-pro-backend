import {
	S3Client,
	PutObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/env';
import crypto from 'crypto';
import fs from 'fs';

interface CachedUrl {
	url: string;
	expiresAt: number;
}

/**
 * Оптимизированный сервис для работы с хранилищем Cloudflare R2
 */
export class StorageService {
	private s3Client: S3Client;
	private bucketName: string;
	private publicDomain: string;
	private urlCache = new Map<string, CachedUrl>();

	constructor() {
		this.bucketName = config.r2.bucketName;
		this.publicDomain =
			config.r2.publicDomain || `https://${this.bucketName}.r2.dev`;

		this.s3Client = new S3Client({
			region: 'auto',
			endpoint: config.r2.endpoint,
			credentials: {
				accessKeyId: config.r2.accessKey,
				secretAccessKey: config.r2.secretKey,
			},
		});

		// Очистка кэша каждый час
		setInterval(() => this.cleanExpiredCache(), 3600000);
	}

	/**
	 * Генерирует presigned URL для загрузки файла напрямую в R2
	 */
	async generateUploadUrl(
		fileName: string,
		contentType: string,
		folder: string = 'uploads',
	): Promise<{ uploadUrl: string; fileKey: string }> {
		const fileExt = fileName.split('.').pop();
		const randomName = crypto.randomBytes(16).toString('hex');
		const fileKey = `${folder}/${randomName}.${fileExt}`;

		try {
			const command = new PutObjectCommand({
				Bucket: this.bucketName,
				Key: fileKey,
				ContentType: contentType,
			});

			const uploadUrl = await getSignedUrl(this.s3Client, command, {
				expiresIn: 300, // 5 минут на загрузку
			});

			return { uploadUrl, fileKey };
		} catch (error) {
			console.error('Ошибка генерации URL для загрузки:', error);
			throw new Error('Не удалось создать ссылку для загрузки файла');
		}
	}

	/**
	 * Получает оптимизированный URL для доступа к файлу
	 */
	async getOptimizedUrl(
		fileKey: string,
		options: {
			width?: number;
			height?: number;
			format?: 'webp' | 'jpeg' | 'png';
			quality?: number;
		} = {},
	): Promise<string> {
		if (!fileKey) return '';

		// Проверяем кэш
		const cacheKey = `${fileKey}_${JSON.stringify(options)}`;
		const cached = this.urlCache.get(cacheKey);

		if (cached && cached.expiresAt > Date.now()) {
			return cached.url;
		}

		try {
			// Если есть публичный домен, используем его с параметрами трансформации
			if (this.publicDomain) {
				const params = new URLSearchParams();
				if (options.width) params.set('w', options.width.toString());
				if (options.height) params.set('h', options.height.toString());
				if (options.format) params.set('f', options.format);
				if (options.quality) params.set('q', options.quality.toString());

				const url = `${this.publicDomain}/${fileKey}${
					params.toString() ? '?' + params.toString() : ''
				}`;

				// Кэшируем на 23 часа
				this.urlCache.set(cacheKey, {
					url,
					expiresAt: Date.now() + 23 * 60 * 60 * 1000,
				});

				return url;
			}

			// Fallback на signed URL
			const command = new GetObjectCommand({
				Bucket: this.bucketName,
				Key: fileKey,
			});

			const url = await getSignedUrl(this.s3Client, command, {
				expiresIn: 86400,
			});

			// Кэшируем на 23 часа
			this.urlCache.set(cacheKey, {
				url,
				expiresAt: Date.now() + 23 * 60 * 60 * 1000,
			});

			return url;
		} catch (error) {
			console.error('Ошибка получения URL:', error);
			return '';
		}
	}

	/**
	 * Получает множественные URL за один запрос
	 */
	async getBatchUrls(
		fileKeys: string[],
		options: {
			width?: number;
			height?: number;
			format?: 'webp' | 'jpeg' | 'png';
			quality?: number;
		} = {},
	): Promise<Record<string, string>> {
		const result: Record<string, string> = {};

		const promises = fileKeys.map(async (fileKey) => {
			const url = await this.getOptimizedUrl(fileKey, options);
			result[fileKey] = url;
		});

		await Promise.all(promises);
		return result;
	}

	/**
	 * Генерирует подписанный URL для доступа к файлу (обратная совместимость)
	 */
	async getSignedUrl(
		fileKey: string,
		expiresIn: number = 86400,
	): Promise<string> {
		return this.getOptimizedUrl(fileKey);
	}

	/**
	 * Загружает файл в R2 (оставляем для обратной совместимости)
	 */
	async uploadFile(
		file: Express.Multer.File,
		folder: string = 'uploads',
	): Promise<string> {
		const fileExt = file.originalname.split('.').pop();
		const randomName = crypto.randomBytes(16).toString('hex');
		const fileName = `${folder}/${randomName}.${fileExt}`;

		try {
			await this.s3Client.send(
				new PutObjectCommand({
					Bucket: this.bucketName,
					Key: fileName,
					Body: fs.createReadStream(file.path),
					ContentType: file.mimetype,
				}),
			);

			fs.unlinkSync(file.path);
			return fileName;
		} catch (error) {
			console.error('Ошибка загрузки файла в R2:', error);
			throw new Error('Не удалось загрузить файл в хранилище');
		}
	}

	/**
	 * Удаляет файл из R2
	 */
	async deleteFile(fileKey: string): Promise<void> {
		try {
			await this.s3Client.send(
				new DeleteObjectCommand({
					Bucket: this.bucketName,
					Key: fileKey,
				}),
			);

			// Очищаем кэш для этого файла
			for (const [key] of this.urlCache) {
				if (key.startsWith(fileKey)) {
					this.urlCache.delete(key);
				}
			}
		} catch (error) {
			console.error('Ошибка удаления файла из R2:', error);
			throw new Error('Не удалось удалить файл из хранилища');
		}
	}

	/**
	 * Очищает просроченные записи из кэша
	 */
	private cleanExpiredCache(): void {
		const now = Date.now();
		for (const [key, cached] of this.urlCache) {
			if (cached.expiresAt <= now) {
				this.urlCache.delete(key);
			}
		}
	}

	/**
	 * Получает статистику кэша
	 */
	getCacheStats(): { size: number; hitRatio: number } {
		return {
			size: this.urlCache.size,
			hitRatio: 0, // Можно добавить счетчики hit/miss
		};
	}
}
