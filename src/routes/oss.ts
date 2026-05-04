import { Router } from 'express';
import * as ossController from '../controllers/oss.controller.js';
import { authenticate } from '../middlewares/auth.js';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// 后端直接上传文件
router.post('/upload', authenticate, upload.single('file'), ossController.uploadFile);

export default router;
