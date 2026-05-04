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
  // 1. 记录日志 (可以在此处集成更高级的日志库，如 Winston)
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  })

  // 2. 归一化：将所有非业务异常统一包装为 AppError (InternalError)
  const appError = err instanceof AppError 
    ? err 
    : new AppError(ErrorCode.InternalError);

  // 3. 统一出口：确保所有错误响应结构完全一致
  res.status(appError.statusCode).json({
    success: false,
    message: appError.message,
    errorCode: appError.errorCode,
  });
};
