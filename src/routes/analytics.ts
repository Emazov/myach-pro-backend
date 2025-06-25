import { Router } from 'express';
import { initDataAuth } from '../middleware/validateInitData';
import { checkAdminRole } from '../middleware/checkAdminRole';
import {
	logEvent,
	startGameSession,
	completeGameSession,
	getStats,
	getDetailedStats,
	resetAnalytics,
} from '../controllers/analytics.controller';

const router = Router();

// Публичные маршруты (для всех пользователей) - используют initDataAuth для чтения из заголовка Authorization
router.post('/event', initDataAuth, logEvent);
router.post('/game/start', initDataAuth, startGameSession);
router.post('/game/complete', initDataAuth, completeGameSession);

// Приватные маршруты (только для админов) - используют initDataAuth для GET запросов
router.get('/stats', initDataAuth, checkAdminRole, getStats);
router.get('/stats/detailed', initDataAuth, checkAdminRole, getDetailedStats);

// Критический маршрут - сброс аналитики (только для админов)
router.delete('/reset', initDataAuth, checkAdminRole, resetAnalytics);

export default router;
