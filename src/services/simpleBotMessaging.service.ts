import { redisService } from './redis.service';
import { logger } from '../utils/logger';

interface ImageTask {
	id: string;
	chatId: number;
	imageBuffer: string; // base64
	caption: string;
	timestamp: number;
}

/**
 * Простой сервис для отправки изображений через Redis
 * Избегает проблем с IPC в PM2 cluster mode
 */
export class SimpleBotMessagingService {
	private static instance: SimpleBotMessagingService;
	private botService: any = null;
	private isProcessingTasks = false;

	private constructor() {
		this.startTaskProcessor();
	}

	public static getInstance(): SimpleBotMessagingService {
		if (!SimpleBotMessagingService.instance) {
			SimpleBotMessagingService.instance = new SimpleBotMessagingService();
		}
		return SimpleBotMessagingService.instance;
	}

	/**
	 * Устанавливает ссылку на bot service (только в master процессе)
	 */
	public setBotService(botService: any) {
		this.botService = botService;
	}

	/**
	 * Запускает обработчик задач в master процессе
	 */
	private startTaskProcessor() {
		const isMasterProcess = process.env.pm_id === '0';

		if (isMasterProcess && !this.isProcessingTasks) {
			this.isProcessingTasks = true;
			this.processImageTasks();
		}
	}

	/**
	 * Обрабатывает задачи отправки изображений (только в master процессе)
	 */
	private async processImageTasks() {
		const isMasterProcess = process.env.pm_id === '0';

		if (!isMasterProcess) return;

		try {
			// Получаем задачу из Redis очереди
			const taskData = await redisService
				.getClient()
				.blpop('image_send_queue', 1);

			if (taskData) {
				const task: ImageTask = JSON.parse(taskData[1]);
				await this.handleImageTask(task);
			}
		} catch (error) {
			logger.error(
				'Ошибка обработки задач изображений',
				'TELEGRAM_BOT',
				error as Error,
			);
		}

		// Продолжаем обработку
		if (this.isProcessingTasks) {
			setTimeout(() => this.processImageTasks(), 100);
		}
	}

	/**
	 * Обрабатывает одну задачу отправки изображения
	 */
	private async handleImageTask(task: ImageTask) {
		try {
			if (!this.botService?.isBotAvailable()) {
				logger.error(
					'Bot service недоступен при обработке задачи',
					'TELEGRAM_BOT',
				);
				return;
			}

			// Конвертируем base64 обратно в Buffer
			const imageBuffer = Buffer.from(task.imageBuffer, 'base64');

			// Отправляем изображение
			const success = await this.botService.sendImage(
				task.chatId,
				imageBuffer,
				task.caption,
			);

			// Сохраняем результат в Redis для worker процесса
			await redisService.getClient().setex(
				`image_result:${task.id}`,
				30, // TTL 30 секунд
				JSON.stringify({ success, timestamp: Date.now() }),
			);

			logger.imageSent(success, task.chatId.toString(), imageBuffer.length);
		} catch (error) {
			logger.error(
				'Ошибка отправки изображения в задаче',
				'TELEGRAM_BOT',
				error as Error,
			);

			// Сохраняем ошибку
			await redisService
				.getClient()
				.setex(
					`image_result:${task.id}`,
					30,
					JSON.stringify({ success: false, error: (error as Error).message }),
				);
		}
	}

	/**
	 * Отправка изображения (универсальный метод)
	 */
	public async sendImage(
		chatId: number,
		imageBuffer: Buffer,
		caption: string,
	): Promise<boolean> {
		const isMasterProcess = process.env.pm_id === '0';

		// Если мы в master процессе - отправляем напрямую
		if (isMasterProcess && this.botService?.isBotAvailable()) {
			try {
				return await this.botService.sendImage(chatId, imageBuffer, caption);
			} catch (error) {
				logger.error(
					'Ошибка прямой отправки в master процессе',
					'TELEGRAM_BOT',
					error as Error,
				);
				return false;
			}
		}

		// Если мы в worker процессе - добавляем задачу в Redis очередь
		try {
			const taskId = `${Date.now()}-${Math.random()}`;
			const task: ImageTask = {
				id: taskId,
				chatId,
				imageBuffer: imageBuffer.toString('base64'),
				caption,
				timestamp: Date.now(),
			};

			// Добавляем задачу в очередь
			await redisService
				.getClient()
				.rpush('image_send_queue', JSON.stringify(task));

			// Ждем результат (максимум 15 секунд)
			for (let i = 0; i < 150; i++) {
				const result = await redisService
					.getClient()
					.get(`image_result:${taskId}`);
				if (result) {
					const parsed = JSON.parse(result);
					await redisService.getClient().del(`image_result:${taskId}`);
					return parsed.success === true;
				}
				await new Promise((resolve) => setTimeout(resolve, 100));
			}

			logger.error(
				'Таймаут ожидания результата отправки изображения',
				'TELEGRAM_BOT',
			);
			return false;
		} catch (error) {
			logger.error(
				'Ошибка добавления задачи в очередь',
				'TELEGRAM_BOT',
				error as Error,
			);
			return false;
		}
	}

	/**
	 * Остановка обработки задач
	 */
	public stop() {
		this.isProcessingTasks = false;
	}
}

export const simpleBotMessagingService =
	SimpleBotMessagingService.getInstance();
