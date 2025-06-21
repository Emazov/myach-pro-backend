import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import crypto from 'crypto';

// Настройка хранилища для multer
const storage = multer.diskStorage({
	// Временная директория для хранения файлов перед отправкой в R2
	destination: (req, file, cb) => {
		cb(null, path.join(process.cwd(), 'tmp/uploads'));
	},
	// Генерируем уникальное имя файла
	filename: (req, file, cb) => {
		const randomName = crypto.randomBytes(16).toString('hex');
		const fileExt = path.extname(file.originalname);
		cb(null, `${randomName}${fileExt}`);
	},
});

// Фильтр для проверки типа файла (только изображения)
const fileFilter = (
	req: Request,
	file: Express.Multer.File,
	cb: multer.FileFilterCallback,
) => {
	const allowedMimeTypes = [
		'image/jpeg',
		'image/png',
		'image/webp',
		'image/gif',
		'image/svg+xml',
	];

	if (allowedMimeTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(
			new Error(
				'Неподдерживаемый формат файла. Разрешены только изображения (JPEG, PNG, WebP, GIF, SVG)',
			),
		);
	}
};

// Лимиты для загрузки файлов
const limits = {
	fileSize: 5 * 1024 * 1024, // 5MB
};

// Middleware для загрузки изображения клуба
export const uploadClubLogo = multer({
	storage,
	fileFilter,
	limits,
}).single('logo');

// Middleware для загрузки аватара игрока
export const uploadPlayerAvatar = multer({
	storage,
	fileFilter,
	limits,
}).single('avatar');

// Middleware для обработки ошибок загрузки
export const handleUploadError = (
	err: any,
	req: Request,
	res: any,
	next: any,
) => {
	if (err instanceof multer.MulterError) {
		if (err.code === 'LIMIT_FILE_SIZE') {
			return res
				.status(400)
				.json({ error: 'Размер файла не должен превышать 5MB' });
		}
		return res
			.status(400)
			.json({ error: `Ошибка загрузки файла: ${err.message}` });
	}

	if (err) {
		return res.status(400).json({ error: err.message });
	}

	next();
};
