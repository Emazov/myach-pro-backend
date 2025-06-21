import { Router } from 'express';
import {
	sendTierListMessage,
	getBotChats,
} from '../controllers/bot.controller';
import { initDataAuth } from '../middleware/validateInitData';

const router = Router();

// Отправка сообщения с тир-листом в чат
router.post('/send-message', initDataAuth, sendTierListMessage);

// Получение списка чатов бота
router.get('/chats', initDataAuth, getBotChats);

export default router;
