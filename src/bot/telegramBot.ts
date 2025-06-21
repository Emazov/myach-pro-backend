import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config/env';

/**
 * Класс для управления Telegram ботом
 */
export class TelegramBotService {
	private bot: TelegramBot;

	constructor() {
		this.bot = new TelegramBot(config.telegram.botToken, { polling: true });
		this.setupCommands();
	}

	/**
	 * Настройка обработчиков команд бота
	 */
	private setupCommands() {
		// Обработчик для команды /start
		this.bot.onText(/\/start/, async (msg) => {
			const chatId = msg.chat.id;
			await this.sendWebAppButton(chatId);
		});
	}

	/**
	 * Отправляет сообщение с кнопкой для открытия веб-приложения
	 */
	private async sendWebAppButton(chatId: number) {
		const inlineKeyboard = [
			[
				{
					text: 'Открыть Тир Лист',
					web_app: { url: config.webApp.url },
				},
			],
		];

		await this.bot.sendMessage(
			chatId,
			'Добро пожаловать! Нажмите кнопку ниже:',
			{
				reply_markup: { inline_keyboard: inlineKeyboard },
			},
		);
	}

	/**
	 * Возвращает экземпляр бота
	 */
	public getBot(): TelegramBot {
		return this.bot;
	}
}
