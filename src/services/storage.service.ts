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

/**
 * Сервис для работы с хранилищем Cloudflare R2
 */
export class StorageService {
	private s3Client: S3Client;
	private bucketName: string;

	constructor() {
		this.bucketName = config.r2.bucketName;

		this.s3Client = new S3Client({
			region: 'auto',
			endpoint: config.r2.endpoint,
			credentials: {
				accessKeyId: config.r2.accessKey,
				secretAccessKey: config.r2.secretKey,
			},
		});
	}

	/**
	 * Загружает файл в R2 и возвращает ключ файла
	 * @param file - файл для загрузки
	 * @param folder - папка для хранения в бакете
	 * @returns Ключ файла в хранилище
	 */
	async uploadFile(
		file: Express.Multer.File,
		folder: string = 'uploads',
	): Promise<string> {
		// Генерируем уникальное имя файла
		const fileExt = file.originalname.split('.').pop();
		const randomName = crypto.randomBytes(16).toString('hex');
		const fileName = `${folder}/${randomName}.${fileExt}`;

		try {
			// Загружаем файл в R2
			await this.s3Client.send(
				new PutObjectCommand({
					Bucket: this.bucketName,
					Key: fileName,
					Body: fs.createReadStream(file.path),
					ContentType: file.mimetype,
				}),
			);

			// Удаляем временный файл
			fs.unlinkSync(file.path);

			// Возвращаем ключ файла
			return fileName;
		} catch (error) {
			console.error('Ошибка загрузки файла в R2:', error);
			throw new Error('Не удалось загрузить файл в хранилище');
		}
	}

	/**
	 * Генерирует подписанный URL для доступа к файлу
	 * @param fileKey - ключ файла в хранилище
	 * @param expiresIn - время жизни URL в секундах (по умолчанию 24 часа)
	 * @returns Подписанный URL для доступа к файлу
	 */
	async getSignedUrl(
		fileKey: string,
		expiresIn: number = 86400,
	): Promise<string> {
		try {
			const command = new GetObjectCommand({
				Bucket: this.bucketName,
				Key: fileKey,
			});

			return await getSignedUrl(this.s3Client, command, { expiresIn });
		} catch (error) {
			console.error('Ошибка генерации подписанного URL:', error);
			throw new Error('Не удалось создать ссылку для доступа к файлу');
		}
	}

	/**
	 * Удаляет файл из R2
	 * @param fileKey - ключ файла для удаления
	 */
	async deleteFile(fileKey: string): Promise<void> {
		try {
			await this.s3Client.send(
				new DeleteObjectCommand({
					Bucket: this.bucketName,
					Key: fileKey,
				}),
			);
		} catch (error) {
			console.error('Ошибка удаления файла из R2:', error);
			throw new Error('Не удалось удалить файл из хранилища');
		}
	}
}
