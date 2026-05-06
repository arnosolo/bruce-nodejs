import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { validatePassword, validateEmail } from '../utils/validator.js';
import { ErrorCode } from '../constants/errorCodes.js';
import { AuthRequest } from '../middlewares/auth.js';
import * as userService from '../services/user.service.js';
import * as ossService from '../services/oss.service.js';

/**
 * 辅助函数：生成 JWT
 */
const generateToken = (userId: number, secret: string): string => {
  return jwt.sign({ userId }, secret, { expiresIn: '24h' });
};

/**
 * 辅助函数：处理用户信息，隐藏密码并转换头像 Key 为 URL
 */
const formatUser = (user: any) => {
  if (!user) return null;
  const { password, avatarKey, ...rest } = user;
  return {
    ...rest,
    avatarKey,
    avatarUrl: ossService.getFileUrl(avatarKey),
  };
};

/**
 * 辅助函数：统一响应结构
 */
const formatAuthResponse = (user: any, token: string) => {
  return {
    token,
    user: formatUser(user),
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
    if (existingUser?.deletedAt) {
      return next(new AppError(ErrorCode.AccountDeleted));
    }
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

    if (user.deletedAt) {
      return next(new AppError(ErrorCode.AccountDeleted));
    }

    // 检查是否有密码（适配 OAuth 等无密码场景）
    if (!user.password) {
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

    if (!user || user.deletedAt) {
      return next(new AppError(ErrorCode.Unauthorized));
    }

    res.json({
      success: true,
      data: formatUser(user),
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(new AppError(ErrorCode.Unauthorized));
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      return next(new AppError(ErrorCode.Unauthorized));
    }

    const { name, avatarKey } = req.body;
    const updateData: userService.UpdateProfileInput = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (avatarKey !== undefined) {
      updateData.avatarKey = avatarKey;
    }

    if (Object.keys(updateData).length === 0) {
      return next(new AppError(ErrorCode.InvalidRequest, '没有需要更新的内容'));
    }

    const updatedUser = await userService.updateProfile(userId, updateData);

    res.json({
      success: true,
      message: '个人资料更新成功',
      data: formatUser(updatedUser),
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(new AppError(ErrorCode.Unauthorized));
    }

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return next(new AppError(ErrorCode.InvalidRequest, '必须提供旧密码和新密码'));
    }

    if (!validatePassword(newPassword)) {
      return next(new AppError(ErrorCode.PasswordTooSimple));
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt) {
      return next(new AppError(ErrorCode.Unauthorized));
    }

    if (!user.password) {
      return next(new AppError(ErrorCode.Unauthorized));
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return next(new AppError(ErrorCode.InvalidOldPassword));
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    res.json({
      success: true,
      message: '密码修改成功',
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAccount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(new AppError(ErrorCode.Unauthorized));
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt) {
      return next(new AppError(ErrorCode.Unauthorized));
    }

    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    res.json({
      success: true,
      message: '账号已成功注销',
    });
  } catch (error) {
    next(error);
  }
};
