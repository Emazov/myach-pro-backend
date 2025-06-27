import express from 'express';
import { validateInitData } from '../middleware/validateInitData';
import { shareController } from '../controllers/share.controller';

const router = express.Router();

/**
 * POST /api/share/results
 * Генерирует изображение результатов и отправляет в Telegram
 */
router.post('/results', validateInitData, shareController.shareResults);

/**
 * POST /api/share/preview
 * Предварительный просмотр изображения (сжатое для быстрой загрузки)
 */
router.post('/preview', validateInitData, shareController.previewImage);

/**
 * POST /api/share/download
 * Получение изображения в высоком качестве для шэринга/скачивания
 */
router.post('/download', validateInitData, shareController.downloadImage);

export { router as shareRoutes };
