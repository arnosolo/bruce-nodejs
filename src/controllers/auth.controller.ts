import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { validatePassword, validateEmail } from '../utils/validator.js';
import { ErrorCode } from '../constants/errorCodes.js';

/**
 * 辅助函数：生成 JWT
 */
const generateToken = (userId: number): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // 这种属于系统级错误，抛出给全局处理器捕获
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  return jwt.sign({ userId }, secret, { expiresIn: '24h' });
};

/**
 * 辅助函数：统一响应结构
 */
const formatAuthResponse = (user: any, token: string) => {
  const { password, ...userWithoutPassword } = user;
  return {
    token,
    user: userWithoutPassword,
  };
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = req.body;

    if (!validateEmail(email)) {
      return next(new AppError(ErrorCode.InvalidEmail));
    }

    if (!validatePassword(password)) {
      return next(new AppError(ErrorCode.PasswordTooSimple));
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return next(new AppError(ErrorCode.UserAlreadyExists));
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    try {
      const token = generateToken(user.id);

      res.status(201).json({
        success: true,
        message: '注册成功',
        data: formatAuthResponse(user, token),
      });
    } catch (error: any) {
      console.error('JWT Signing failed:', error.message);
      return next(new AppError(ErrorCode.ConfigError));
    }
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return next(new AppError(ErrorCode.InvalidCredentials));
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return next(new AppError(ErrorCode.InvalidCredentials));
    }

    try {
      const token = generateToken(user.id);
      
      res.json({
        success: true,
        message: '登录成功',
        data: formatAuthResponse(user, token),
      });
    } catch (error: any) {
      console.error('JWT Signing failed:', error.message);
      return next(new AppError(ErrorCode.ConfigError));
    }
  } catch (error) {
    next(error);
  }
};
