import { Request, Response, NextFunction } from 'express';
import { TelegramBotService } from '../bot/telegramBot';
import fs from 'fs';
import path from 'path';

const botService = new TelegramBotService();

/**
 * Отправляет результаты тир-листа в чат
 * @param req - запрос
 * @param res - ответ
 * @param next - следующий обработчик
 */
export const sendTierListMessage = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const { chatId, caption, clubName } = req.body;
		const imageBase64 = req.body.image; // base64 строка изображения

		if (!chatId || !imageBase64) {
			res.status(400).json({ error: 'Отсутствуют обязательные параметры' });
			return;
		}

		// Парсинг base64 изображения
		const base64Data = imageBase64.replace(/^data:image\/png;base64,/, '');
		const imageBuffer = Buffer.from(base64Data, 'base64');

		// Временно сохраняем изображение
		const tmpDir = path.join(process.cwd(), 'tmp/uploads');
		const fileName = `tierlist_${clubName || 'result'}_${Date.now()}.png`;
		const filePath = path.join(tmpDir, fileName);

		fs.writeFileSync(filePath, imageBuffer);

		// Формируем текст сообщения
		const messageText =
			caption ||
			`🏆 ТИР-ЛИСТ ${
				clubName?.toUpperCase() || ''
			}\n\n👉 Собери свой тир-лист в боте @MyachProBot`;

		// Отправляем сообщение с изображением
		const bot = botService.getBot();
		await bot.sendPhoto(chatId, filePath, {
			caption: messageText,
			parse_mode: 'HTML',
		});

		// Удаляем временный файл
		fs.unlinkSync(filePath);

		res.status(200).json({ success: true, message: 'Сообщение отправлено' });
		return;
	} catch (error) {
		console.error('Ошибка при отправке сообщения:', error);
		next(error);
	}
};

/**
 * Получает список чатов бота
 */
export const getBotChats = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		// В Telegram Bot API нет прямого метода для получения списка всех чатов
		// Эту функцию нужно реализовать через хранение чатов в БД
		// Здесь возвращаем заглушку
		res.status(200).json({
			chatId: req.body.user?.id, // ID пользователя из init data
			warning:
				'Функция получения списка чатов не реализована. Возвращается ID текущего пользователя.',
		});
	} catch (error) {
		next(error);
	}
};
