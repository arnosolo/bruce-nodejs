import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.js';
import * as ossService from '../services/oss.service.js';
import { AppError } from '../utils/AppError.js';
import { ErrorCode } from '../constants/errorCodes.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 后端直接上传文件
 */
export const uploadFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(new AppError(ErrorCode.Unauthorized));
    }

    const file = req.file;
    if (!file) {
      return next(new AppError(ErrorCode.InvalidRequest, '没有上传文件'));
    }

    // 生成唯一的 Key: uploads/{userId}/{uuid}-{filename}
    const ext = file.originalname.split('.').pop();
    const key = `uploads/${userId}/${uuidv4()}${ext ? `.${ext}` : ''}`;

    // 上传到 OSS
    const result = await ossService.uploadFile(key, file.buffer);

    res.json({
      success: true,
      data: {
        name: result.name,
        url: result.url,
        key: key,
      },
    });
  } catch (error) {
    next(error);
  }
};
