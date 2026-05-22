import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';
import { ErrorCode } from '../constants/errorCodes.js';
import { prisma } from '../lib/prisma.js';
import { Role } from '../../generated/prisma/index.js';

export interface AuthRequest extends Request {
  user?: {
    id: number;
  };
}

/**
 * 身份验证中间件：检查 JWT Token 并提取用户 ID
 */
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(ErrorCode.Unauthorized));
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET is not defined');
      return next(new AppError(ErrorCode.ConfigError));
    }

    const decoded = jwt.verify(token, secret);
    if (typeof decoded !== 'object' || !decoded || typeof (decoded as any).userId !== 'number') {
      return next(new AppError(ErrorCode.Unauthorized));
    }

    req.user = { id: decoded.userId };
    next();
  } catch (error) {
    return next(new AppError(ErrorCode.Unauthorized));
  }
};

/**
 * 权限验证中间件：检查用户角色
 * @param roles 允许访问的角色列表
 */
export const authorize = (...roles: Role[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError(ErrorCode.Unauthorized));
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user || !roles.includes(user.role)) {
        return next(new AppError(ErrorCode.Forbidden, '您没有权限执行此操作'));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
