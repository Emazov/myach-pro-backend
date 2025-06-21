import { Router } from 'express';
import { checkAdminRole } from '../middleware/checkAdminRole';

import {
	createPlayer,
	deletePlayer,
	getAllPlayers,
	getPlayerById,
	updatePlayer,
} from '../controllers/players.controller';

const router = Router();

router.post('/', checkAdminRole, createPlayer);
router.get('/', getAllPlayers);
router.get('/:id', getPlayerById);
router.put('/:id', checkAdminRole, updatePlayer);
router.delete('/:id', checkAdminRole, deletePlayer);

export default router;
