import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { validatePassword, validateEmail } from '../utils/validator.js';
import { ErrorCode } from '../constants/errorCodes.js';
import { AuthRequest } from '../middlewares/auth.js';

/**
 * 辅助函数：生成 JWT
 */
const generateToken = (userId: number, secret: string): string => {
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

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET is not defined');
      return next(new AppError(ErrorCode.ConfigError));
    }

    const token = generateToken(user.id, secret);

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: formatAuthResponse(user, token),
    });
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

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET is not defined');
      return next(new AppError(ErrorCode.ConfigError));
    }
    
    const token = generateToken(user.id, secret);
    
    res.json({
      success: true,
      message: '登录成功',
      data: formatAuthResponse(user, token),
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(new AppError(ErrorCode.Unauthorized));
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return next(new AppError(ErrorCode.Unauthorized));
    }

    const { password, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: userWithoutPassword,
    });
  } catch (error) {
    next(error);
  }
};

interface UpdateProfileInput {
  name?: string;
}

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(new AppError(ErrorCode.Unauthorized));
    }

    const { name } = req.body as UpdateProfileInput;
    const updateData: UpdateProfileInput = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (Object.keys(updateData).length === 0) {
      return next(new AppError(ErrorCode.InvalidRequest, '没有需要更新的内容'));
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    const { password, ...userWithoutPassword } = updatedUser;

    res.json({
      success: true,
      message: '个人资料更新成功',
      data: userWithoutPassword,
    });
  } catch (error) {
    next(error);
  }
};
