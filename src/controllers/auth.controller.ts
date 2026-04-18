import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { validatePassword, validateEmail } from '../utils/validator.js';

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
      return next(new AppError('邮箱格式不正确', 400, 'INVALID_EMAIL'));
    }

    if (!validatePassword(password)) {
      return next(new AppError('密码太简单，需至少8位且包含大小写字母和数字', 400, 'PASSWORD_TOO_SIMPLE'));
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return next(new AppError('用户已存在', 400, 'USER_ALREADY_EXISTS'));
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
      return next(new AppError('内部配置错误', 500, 'INTERNAL_CONFIGURATION_ERROR'));
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
      return next(new AppError('用户名或密码错误', 401, 'INVALID_CREDENTIALS'));
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return next(new AppError('用户名或密码错误', 401, 'INVALID_CREDENTIALS'));
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
      return next(new AppError('内部配置错误', 500, 'INTERNAL_CONFIGURATION_ERROR'));
    }
  } catch (error) {
    next(error);
  }
};
