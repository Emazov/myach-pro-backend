import { Router } from 'express';
import {
	createClub,
	getAllClubs,
	getClubById,
} from '../controllers/clubs.controller';
import { initDataAuth } from '../middleware/validateInitData';
import { checkAdminRole } from '../middleware/checkAdminRole';

const router = Router();

router.post('/', initDataAuth, checkAdminRole, createClub);
router.get('/', getAllClubs);
router.get('/:id', getClubById);

export default router;
