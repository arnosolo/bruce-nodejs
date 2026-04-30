import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.js';
import * as ossService from '../services/oss.service.js';
import { AppError } from '../utils/AppError.js';
import { ErrorCode } from '../constants/errorCodes.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 获取 OSS 上传签名 (PostObject)
 */
export const getUploadSignature = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(new AppError(ErrorCode.Unauthorized));
    }

    const { filename } = req.query;
    if (!filename || typeof filename !== 'string') {
      return next(new AppError(ErrorCode.InvalidRequest, '文件名不能为空'));
    }

    // 生成唯一的 Key: uploads/{userId}/{uuid}-{filename}
    const ext = filename.split('.').pop();
    const key = `uploads/${userId}/${uuidv4()}${ext ? `.${ext}` : ''}`;

    // 限制 10MB
    const signature = ossService.getPostObjectSignature(key, 10 * 1024 * 1024);

    res.json({
      success: true,
      data: signature,
    });
  } catch (error) {
    next(error);
  }
};
