import { Router } from 'express';
import { register, login, getMe, updateProfile } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateProfile);

export default router;
