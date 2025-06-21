import { Router } from 'express';
import {
	createClub,
	deleteClub,
	getAllClubs,
	getClubById,
	updateClub,
} from '../controllers/clubs.controller';
import { checkAdminRole } from '../middleware/checkAdminRole';

const router = Router();

router.post('/', checkAdminRole, createClub);
router.get('/', getAllClubs);
router.get('/:id', getClubById);
router.put('/:id', checkAdminRole, updateClub);
router.delete('/:id', checkAdminRole, deleteClub);

export default router;
