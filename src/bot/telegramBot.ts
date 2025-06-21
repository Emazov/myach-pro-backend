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
		// Проверяем, что URL соответствует требованиям Telegram (https)
		let messageText = 'Добро пожаловать!';
		let markup: any = {};

		// URL должен начинаться с https:// для работы с Telegram WebApp
		if (config.webApp.url.startsWith('https://')) {
			messageText += ' Нажмите кнопку ниже:';
			const inlineKeyboard = [
				[
					{
						text: 'Открыть Тир Лист',
						web_app: { url: config.webApp.url },
					},
				],
			];
			markup = { reply_markup: { inline_keyboard: inlineKeyboard } };
		} else {
			// В режиме разработки показываем текстовую ссылку
			messageText += `\n\nДля открытия приложения перейдите по ссылке: ${config.webApp.url}\n\nВнимание: WebApp кнопки работают только с HTTPS URL`;
		}

		await this.bot.sendMessage(chatId, messageText, markup);
	}

	/**
	 * Возвращает экземпляр бота
	 */
	public getBot(): TelegramBot {
		return this.bot;
	}

	/**
	 * Отправляет изображение в чат с подписью
	 * @param chatId ID чата
	 * @param imagePath Путь к файлу изображения
	 * @param caption Подпись к изображению
	 */
	public async sendImage(
		chatId: number | string,
		imagePath: string,
		caption?: string,
	): Promise<TelegramBot.Message> {
		return this.bot.sendPhoto(chatId, imagePath, {
			caption,
			parse_mode: 'HTML',
		});
	}
}
