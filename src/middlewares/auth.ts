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
      throw new Error('JWT_SECRET is not defined');
    }

    const decoded = jwt.verify(token, secret) as { userId: number };
    req.user = { id: decoded.userId };
    next();
  } catch (error) {
    return next(new AppError(ErrorCode.Unauthorized));
  }
};
