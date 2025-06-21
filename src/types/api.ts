import { Request } from 'express';

// Расширенный интерфейс Request с данными Telegram
export interface TelegramRequest extends Request {
	body: {
		telegramUser: {
			id: number;
			username?: string;
			first_name?: string;
			last_name?: string;
		};
		initData: any;
		[key: string]: any;
	};
}

// Тип ответа API аутентификации
export interface AuthResponse {
	ok: boolean;
	role: 'admin' | 'user';
	user: {
		id: string;
		telegramId: string;
		username?: string;
		first_name?: string;
	};
}

// Общий тип ответа API с ошибкой
export interface ErrorResponse {
	error: string;
}
