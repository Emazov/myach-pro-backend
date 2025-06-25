import { Router } from 'express';
import { shareController } from '../controllers/share.controller';
import { validateInitData } from '../middleware/validateInitData';

const router = Router();

/**
 * POST /api/share/results
 * Генерирует изображение результатов и отправляет в Telegram
 */
router.post('/results', (req, res) => shareController.shareResults(req, res));

/**
 * POST /api/share/preview
 * Предварительный просмотр изображения (для тестирования)
 */
router.post('/preview', (req, res) => shareController.previewImage(req, res));

export default router;
