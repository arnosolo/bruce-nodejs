import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';
import { ErrorCode } from '../constants/errorCodes.js';

export interface AuthRequest extends Request {
  user?: {
    id: number;
  };
}

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
