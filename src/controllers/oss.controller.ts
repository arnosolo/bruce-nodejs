import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.js';
import * as ossService from '../services/oss.service.js';
import { AppError } from '../utils/AppError.js';
import { ErrorCode } from '../constants/errorCodes.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 通用上传处理逻辑
 * @param req 
 * @param folder 目录前缀 (e.g., 'public/avatar')
 */
const handleUpload = async (req: AuthRequest, folder: string) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(ErrorCode.Unauthorized);
  }

  const file = req.file;
  if (!file) {
    throw new AppError(ErrorCode.InvalidRequest, '没有上传文件');
  }

  // 生成唯一的 Key: {folder}/{userId}/{uuid}-{filename}
  const ext = file.originalname.split('.').pop();
  const key = `${folder}/${userId}/${uuidv4()}${ext ? `.${ext}` : ''}`;

  // 上传到 OSS
  const result = await ossService.uploadFile(key, file.buffer);

  return {
    name: result.name,
    url: ossService.getFileUrl(key), // 使用新的 URL 获取逻辑
    key: key,
  };
};

/**
 * 上传头像 (公开访问)
 */
export const uploadAvatar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await handleUpload(req, 'public/avatar');
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 上传聊天附件 (私有访问)
 */
export const uploadChat = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await handleUpload(req, 'private/chat');
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};
