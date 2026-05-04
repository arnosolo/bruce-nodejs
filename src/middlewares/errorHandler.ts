import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { ErrorCode } from '../constants/errorCodes.js';
import { logger } from '../utils/logger.js';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 1. 归一化：将所有非业务异常统一包装为 AppError (InternalError)
  const appError = err instanceof AppError 
    ? err 
    : new AppError(ErrorCode.InternalError);

  // 2. 记录日志：包含 errorCode 和请求上下文
  // 使用 (message, meta) 形式以确保最佳的 TS 类型兼容性
  logger.error(err.message, {
    ip: req.ip,
    method: req.method,
    path: req.path,
    errorCode: appError.errorCode,
    stack: err.stack,
  }); 

  // 3. 统一出口：确保所有错误响应结构完全一致
  res.status(appError.statusCode).json({
    success: false,
    message: appError.message,
    errorCode: appError.errorCode,
  });
};
