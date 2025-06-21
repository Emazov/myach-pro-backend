import { Router } from 'express';
import {
	createClub,
	getAllClubs,
	getClubById,
} from '../controllers/clubs.controller';
import { checkAdminRole } from '../middleware/checkAdminRole';

const router = Router();

// Создание клуба - только для админа
router.post('/', checkAdminRole, createClub);

// Получение списка всех клубов - доступно авторизованным пользователям
router.get('/', getAllClubs);

// Получение информации о конкретном клубе - доступно авторизованным пользователям
router.get('/:id', getClubById);

export default router;
