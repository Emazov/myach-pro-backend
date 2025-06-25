import { Router } from 'express';
import {
	generateUploadUrl,
	getBatchImageUrls,
	getCacheStats,
} from '../controllers/upload.controller';
import { initDataAuth } from '../middleware/validateInitData';
import { checkAdminRole } from '../middleware/checkAdminRole';

const router = Router();

// Генерация URL для прямой загрузки (только для админов)
router.post('/url', initDataAuth, checkAdminRole, generateUploadUrl);

// Получение множественных оптимизированных URL (для всех авторизованных пользователей)
router.post('/batch-urls', initDataAuth, getBatchImageUrls);

// Получение статистики кэша (только для админов)
router.get('/cache-stats', initDataAuth, checkAdminRole, getCacheStats);

export default router;
