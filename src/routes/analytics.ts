import { Router } from 'express';
import { validateInitData } from '../middleware/validateInitData';
import { checkAdminRole } from '../middleware/checkAdminRole';
import {
	logEvent,
	startGameSession,
	completeGameSession,
	getStats,
	getDetailedStats,
} from '../controllers/analytics.controller';

const router = Router();

// Все маршруты требуют валидации Telegram данных
router.use(validateInitData);

// Публичные маршруты (для всех пользователей)
router.post('/event', logEvent);
router.post('/game/start', startGameSession);
router.post('/game/complete', completeGameSession);

// Приватные маршруты (только для админов)
router.get('/stats', checkAdminRole, getStats);
router.get('/stats/detailed', checkAdminRole, getDetailedStats);

export default router;
