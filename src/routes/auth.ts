import { Router } from 'express';
import { authUser } from '../controllers/auth.controller';

const router = Router();

/**
 * @route   POST /api/auth
 * @desc    Авторизация через данные Telegram
 * @access  Public
 */
router.post('/', authUser);

export default router;
