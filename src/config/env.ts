import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Определяем переменные окружения с проверкой наличия
const getEnvVar = (key: string, defaultValue?: string): string => {
	const value = process.env[key] || defaultValue;

	if (value === undefined) {
		throw new Error(`Переменная окружения ${key} не установлена`);
	}

	return value;
};

// Типизированные переменные окружения
export const config = {
	port: parseInt(getEnvVar('PORT', '3001'), 10),
	telegram: {
		botToken: getEnvVar('TELEGRAM_BOT_TOKEN'),
		adminId: getEnvVar('TELEGRAM_ADMIN_ID'),
	},
	webApp: {
		url: getEnvVar('WEB_APP_URL'),
	},
	cors: {
		origins: [
			'https://telegram-test-bot-murex.vercel.app',
			'https://myach-pro.vercel.app',
		],
	},
	r2: {
		accessKey: getEnvVar('R2_ACCESS_KEY'),
		secretKey: getEnvVar('R2_SECRET_KEY'),
		bucketName: getEnvVar('R2_BUCKET_NAME'),
		endpoint: getEnvVar('R2_ENDPOINT'),
	},
};
