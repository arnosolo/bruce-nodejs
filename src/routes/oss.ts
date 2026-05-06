import { Router } from 'express';
import * as ossController from '../controllers/oss.controller.js';
import { authenticate } from '../middlewares/auth.js';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// 上传头像 (公开)
router.post('/upload/avatar', authenticate, upload.single('file'), ossController.uploadAvatar);

// 上传聊天附件 (私有)
router.post('/upload/chat', authenticate, upload.single('file'), ossController.uploadChat);

export default router;
