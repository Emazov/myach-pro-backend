import { Router } from 'express';
import { validateInitData, initDataAuth } from '../middleware/validateInitData';
import { checkAdminRole } from '../middleware/checkAdminRole';
import {
	logEvent,
	startGameSession,
	completeGameSession,
	getStats,
	getDetailedStats,
} from '../controllers/analytics.controller';

const router = Router();

// Публичные маршруты (для всех пользователей) - используют validateInitData для POST запросов
router.post('/event', validateInitData, logEvent);
router.post('/game/start', validateInitData, startGameSession);
router.post('/game/complete', validateInitData, completeGameSession);

// Приватные маршруты (только для админов) - используют initDataAuth для GET запросов
router.get('/stats', initDataAuth, checkAdminRole, getStats);
router.get('/stats/detailed', initDataAuth, checkAdminRole, getDetailedStats);

export default router;
