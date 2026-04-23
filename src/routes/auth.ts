import { Router } from 'express';
import { register, login, getMe, updateProfile, changePassword } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateProfile);
router.put('/password', authenticate, changePassword);

export default router;
