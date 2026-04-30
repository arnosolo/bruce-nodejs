import { Router } from 'express';
import * as ossController from '../controllers/oss.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

// 需要认证才能获取上传权限
router.get('/upload-signature', authenticate, ossController.getUploadSignature);

export default router;
