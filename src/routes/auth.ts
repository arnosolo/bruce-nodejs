import { Router } from 'express';
import { register, login, sendLoginCode, loginByCode, getMe, updateProfile, changePassword, deleteAccount, updateUserRole, listUsers, verifyEmail, resendVerificationCode } from '../controllers/auth.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { Role } from '../../generated/prisma/index.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/resend-code', resendVerificationCode);
router.post('/send-login-code', sendLoginCode);
router.post('/login-by-code', loginByCode);
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateProfile);
router.put('/password', authenticate, changePassword);
router.delete('/me', authenticate, deleteAccount);

// 管理员接口
router.get('/users', authenticate, authorize(Role.ADMIN), listUsers);
router.patch('/users/:id/role', authenticate, authorize(Role.ADMIN), updateUserRole);


export default router;
