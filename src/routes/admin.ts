import { Router } from 'express';
import { validateInitData } from '../middleware/validateInitData';
import { checkAdminRole } from '../middleware/checkAdminRole';
import {
	getAdmins,
	addAdmin,
	removeAdmin,
	searchUsers,
	addAdminByUsername,
} from '../controllers/admin.controller';

const router = Router();

// Все маршруты требуют валидации Telegram данных и роли админа
router.use(validateInitData);
router.use(checkAdminRole);

// GET /api/admin/admins - получить список админов
router.get('/admins', getAdmins);

// POST /api/admin/admins - добавить нового админа
router.post('/admins', addAdmin);

// DELETE /api/admin/admins/:telegramId - удалить админа
router.delete('/admins/:telegramId', removeAdmin);

// GET /api/admin/search-users - поиск пользователей по username
router.get('/search-users', searchUsers);

// POST /api/admin/admins/by-username - добавить админа по username
router.post('/admins/by-username', addAdminByUsername);

export default router;
