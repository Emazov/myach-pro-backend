import { Router } from 'express';
import {
	generateUploadUrl,
	getBatchImageUrls,
	getCacheStats,
} from '../controllers/upload.controller';
import { validateInitData } from '../middleware/validateInitData';
import { checkAdminRole } from '../middleware/checkAdminRole';

const router = Router();

// Генерация URL для прямой загрузки (только для админов)
router.post('/url', validateInitData, checkAdminRole, generateUploadUrl);

// Получение множественных оптимизированных URL (для всех авторизованных пользователей)
router.post('/batch-urls', validateInitData, getBatchImageUrls);

// Получение статистики кэша (только для админов)
router.get('/cache-stats', validateInitData, checkAdminRole, getCacheStats);

export default router;
