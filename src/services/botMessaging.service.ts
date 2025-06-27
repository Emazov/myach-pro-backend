import cluster from 'node:cluster';
import { Worker } from 'node:cluster';
import { logger } from '../utils/logger';

interface ImageSendTask {
	type: 'SEND_IMAGE';
	chatId: number;
	imageBuffer: Buffer;
	caption: string;
	taskId: string;
}

interface ImageSendResult {
	type: 'IMAGE_SENT';
	taskId: string;
	success: boolean;
	error?: string;
}

/**
 * Сервис для обмена сообщениями между worker и master процессами
 * Решает проблему отправки изображений через Telegram бота из worker процессов
 */
export class BotMessagingService {
	private static instance: BotMessagingService;
	private pendingTasks = new Map<
		string,
		{ resolve: (success: boolean) => void; timeout: NodeJS.Timeout }
	>();
	private botService: any = null;

	private constructor() {
		this.setupMessageHandlers();
	}

	public static getInstance(): BotMessagingService {
		if (!BotMessagingService.instance) {
			BotMessagingService.instance = new BotMessagingService();
		}
		return BotMessagingService.instance;
	}

	/**
	 * Устанавливает ссылку на bot service (только в master процессе)
	 */
	public setBotService(botService: any) {
		this.botService = botService;
	}

	/**
	 * Настройка обработчиков сообщений между процессами
	 */
	private setupMessageHandlers() {
		if (cluster.isPrimary) {
			// Master процесс: обрабатывает запросы от workers
			cluster.on('message', async (worker, message: ImageSendTask) => {
				if (message.type === 'SEND_IMAGE') {
					await this.handleImageSendTask(worker, message);
				}
			});
		} else {
			// Worker процесс: получает результаты от master
			process.on('message', (message: ImageSendResult) => {
				if (message.type === 'IMAGE_SENT') {
					this.handleImageSentResult(message);
				}
			});
		}
	}

	/**
	 * Обработка задачи отправки изображения в master процессе
	 */
	private async handleImageSendTask(worker: Worker, task: ImageSendTask) {
		let success = false;
		let error = '';

		try {
			if (this.botService && this.botService.isBotAvailable()) {
				success = await this.botService.sendImage(
					task.chatId,
					task.imageBuffer,
					task.caption,
				);
			} else {
				error = 'Bot service не доступен в master процессе';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}

		// Отправляем результат обратно worker процессу
		worker.send({
			type: 'IMAGE_SENT',
			taskId: task.taskId,
			success,
			error,
		} as ImageSendResult);
	}

	/**
	 * Обработка результата отправки в worker процессе
	 */
	private handleImageSentResult(result: ImageSendResult) {
		const task = this.pendingTasks.get(result.taskId);
		if (task) {
			clearTimeout(task.timeout);
			this.pendingTasks.delete(result.taskId);
			task.resolve(result.success);
		}
	}

	/**
	 * Отправка изображения (из worker процесса в master)
	 */
	public async sendImage(
		chatId: number,
		imageBuffer: Buffer,
		caption: string,
	): Promise<boolean> {
		// Если мы в master процессе и бот доступен - отправляем напрямую
		if (cluster.isPrimary && this.botService?.isBotAvailable()) {
			return await this.botService.sendImage(chatId, imageBuffer, caption);
		}

		// Если мы в worker процессе - отправляем через IPC
		if (!cluster.isPrimary) {
			return new Promise((resolve) => {
				const taskId = `${Date.now()}-${Math.random()}`;

				// Таймаут 10 секунд
				const timeout = setTimeout(() => {
					this.pendingTasks.delete(taskId);
					logger.error(
						'Таймаут отправки изображения через IPC',
						'TELEGRAM_BOT',
					);
					resolve(false);
				}, 10000);

				this.pendingTasks.set(taskId, { resolve, timeout });

				// Отправляем задачу master процессу
				process.send?.({
					type: 'SEND_IMAGE',
					chatId,
					imageBuffer,
					caption,
					taskId,
				} as ImageSendTask);
			});
		}

		// Fallback - не удалось отправить
		logger.error(
			'Не удалось определить способ отправки изображения',
			'TELEGRAM_BOT',
		);
		return false;
	}
}

export const botMessagingService = BotMessagingService.getInstance();
