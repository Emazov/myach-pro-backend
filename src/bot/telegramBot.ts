import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Класс для управления Telegram ботом
 * ИСПРАВЛЕНИЕ: Только один процесс (master) управляет ботом в кластере
 */
export class TelegramBotService {
	private bot: TelegramBot | null = null;
	private isClusterMaster: boolean;

	constructor() {
		// Проверяем, является ли процесс master в кластере
		this.isClusterMaster = !process.env.pm_id || process.env.pm_id === '0';

		// Инициализируем бота только в master процессе
		if (this.isClusterMaster) {
			logger.info(
				'🤖 Инициализация Telegram бота в master процессе',
				'TELEGRAM_BOT',
			);
			this.initializeBot();
		} else {
			logger.info(
				`⚠️ Процесс ${process.env.pm_id} пропускает инициализацию Telegram бота`,
				'TELEGRAM_BOT',
			);
		}
	}

	/**
	 * Инициализация бота (только в master процессе)
	 */
	private initializeBot() {
		try {
			this.bot = new TelegramBot(config.telegram.botToken, {
				polling: true,
				// Дополнительные настройки для стабильности
				request: {
					url: '',
					agentOptions: {
						keepAlive: true,
						family: 4, // Принудительно IPv4
					},
				} as any,
			});

			this.setupCommands();
			this.setupErrorHandlers();

			logger.info('✅ Telegram бот успешно инициализирован', 'TELEGRAM_BOT');
		} catch (error) {
			logger.error(
				'❌ Ошибка инициализации Telegram бота:',
				'TELEGRAM_BOT',
				error,
			);
		}
	}

	/**
	 * Настройка обработчиков ошибок
	 */
	private setupErrorHandlers() {
		if (!this.bot) return;

		this.bot.on('error', (error) => {
			logger.error('❌ Ошибка Telegram бота:', 'TELEGRAM_BOT', error);
		});

		this.bot.on('polling_error', (error) => {
			logger.error('❌ Ошибка polling Telegram бота:', 'TELEGRAM_BOT', error);
		});

		// Graceful restart при критических ошибках
		this.bot.on('webhook_error', (error) => {
			logger.error('❌ Критическая ошибка webhook:', 'TELEGRAM_BOT', error);
		});
	}

	/**
	 * Настройка обработчиков команд бота
	 */
	private setupCommands() {
		if (!this.bot) return;

		// Обработчик для команды /start
		this.bot.onText(/\/start/, async (msg) => {
			try {
				const chatId = msg.chat.id;
				const userName =
					msg.from?.username || msg.from?.first_name || 'пользователь';

				logger.info(
					`📱 Команда /start от пользователя: ${userName} (${chatId})`,
					'TELEGRAM_BOT',
				);
				await this.sendWebAppButton(chatId);
			} catch (error) {
				logger.error(
					'❌ Ошибка обработки команды /start:',
					'TELEGRAM_BOT',
					error,
				);
			}
		});

		// Обработчик для всех остальных команд
		this.bot.on('message', async (msg) => {
			if (msg.text && !msg.text.startsWith('/start')) {
				try {
					const chatId = msg.chat.id;
					await this.sendWebAppButton(chatId);
				} catch (error) {
					logger.error('❌ Ошибка обработки сообщения:', 'TELEGRAM_BOT', error);
				}
			}
		});
	}

	/**
	 * Отправляет сообщение с кнопкой для открытия веб-приложения
	 */
	private async sendWebAppButton(chatId: number) {
		if (!this.bot) {
			logger.warn(
				'⚠️ Попытка отправить сообщение, но бот не инициализирован',
				'TELEGRAM_BOT',
			);
			return;
		}

		try {
			// Проверяем, что URL соответствует требованиям Telegram (https)
			let messageText = 'Добро пожаловать в Myach Pro! ⚽';
			let markup: any = {};

			// URL должен начинаться с https:// для работы с Telegram WebApp
			if (config.webApp.url.startsWith('https://')) {
				messageText += '\n\nНажмите кнопку ниже, чтобы создать свой тир-лист:';
				const inlineKeyboard = [
					[
						{
							text: '🎯 Открыть Тир Лист',
							web_app: { url: config.webApp.url },
						},
					],
				];
				markup = { reply_markup: { inline_keyboard: inlineKeyboard } };
			} else {
				// В режиме разработки показываем текстовую ссылку
				messageText += `\n\n🔗 Для открытия приложения перейдите по ссылке: ${config.webApp.url}\n\n⚠️ Внимание: WebApp кнопки работают только с HTTPS URL`;
			}

			await this.bot.sendMessage(chatId, messageText, markup);
			logger.info(
				`✅ Сообщение отправлено пользователю ${chatId}`,
				'TELEGRAM_BOT',
			);
		} catch (error) {
			logger.error('❌ Ошибка отправки сообщения:', 'TELEGRAM_BOT', error);
		}
	}

	/**
	 * Отправка изображения через бота (для кроссплатформенного шэринга)
	 */
	public async sendImage(
		chatId: number,
		imageBuffer: Buffer,
		caption?: string,
	): Promise<boolean> {
		if (!this.bot) {
			logger.warn(
				'⚠️ Попытка отправить изображение, но бот не инициализирован',
				'TELEGRAM_BOT',
			);
			return false;
		}

		try {
			await this.bot.sendPhoto(chatId, imageBuffer, {
				caption: caption || 'Ваш тир-лист готов! 🎯',
			});

			logger.info(
				`✅ Изображение отправлено пользователю ${chatId}`,
				'TELEGRAM_BOT',
			);
			return true;
		} catch (error) {
			logger.error('❌ Ошибка отправки изображения:', 'TELEGRAM_BOT', error);
			return false;
		}
	}

	/**
	 * Возвращает экземпляр бота (может быть null в worker процессах)
	 */
	public getBot(): TelegramBot | null {
		return this.bot;
	}

	/**
	 * Проверка доступности бота
	 */
	public isBotAvailable(): boolean {
		return this.isClusterMaster && this.bot !== null;
	}

	/**
	 * Graceful shutdown бота
	 */
	public async shutdown(): Promise<void> {
		if (this.bot && this.isClusterMaster) {
			logger.info('🔄 Остановка Telegram бота...', 'TELEGRAM_BOT');
			try {
				await this.bot.stopPolling();
				logger.info('✅ Telegram бот остановлен', 'TELEGRAM_BOT');
			} catch (error) {
				logger.error('❌ Ошибка при остановке бота:', 'TELEGRAM_BOT', error);
			}
		}
	}
}
