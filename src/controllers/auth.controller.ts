import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { validatePassword, validateEmail } from '../utils/validator.js';
import { generateNumericCode } from '../utils/crypto.js';
import { ErrorCode } from '../constants/errorCodes.js';
import { AuthRequest } from '../middlewares/auth.js';
import * as userService from '../services/user.service.js';
import * as ossService from '../services/oss.service.js';
import * as mailService from '../services/mail.service.js';
import { Role } from '../../generated/prisma/index.js';
import { mapToEnum } from '../utils/mapToEnum.js';

/**
 * 邮箱验证码有效期 (小时)
 */
export const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;

/**
 * 登录验证码有效期 (分钟)
 */
export const LOGIN_CODE_EXPIRY_MINUTES = 10;

/**
 * 登录验证码发送冷却时间 (秒)
 */
export const LOGIN_CODE_COOLDOWN_SECONDS = 60;

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
  const { password, avatarKey, emailVerificationCode, emailVerificationExpires, ...rest } = user;
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

    const adminEmail = process.env.AI_CS_ADMIN_EMAIL;
    const role = (adminEmail && email === adminEmail) ? Role.ADMIN : Role.CUSTOMER;

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 生成 6 位数字验证码
    const verificationCode = generateNumericCode(6);
    const verificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        emailVerificationCode: verificationCode,
        emailVerificationExpires: verificationExpires,
      },
    });

    // 发送验证邮件
    try {
      await mailService.sendVerificationEmail(email, verificationCode, EMAIL_VERIFICATION_EXPIRY_HOURS);
    } catch (mailError) {
      console.error('Failed to send verification email:', mailError);
      // 如果邮件发送失败，删除已创建的用户以允许重新注册
      await prisma.user.delete({ where: { id: user.id } });
      return next(new AppError(ErrorCode.InternalError, '注册失败：验证邮件发送失败，请稍后重试'));
    }

    res.status(201).json({
      success: true,
      message: '注册成功，验证码已发送至您的邮箱',
      data: {
        user: formatUser(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return next(new AppError(ErrorCode.InvalidRequest, '邮箱和验证码不能为空'));
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user || user.deletedAt || user.emailVerificationCode !== code) {
      return next(new AppError(ErrorCode.InvalidVerificationCode, '验证码错误'));
    }

    if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
      return next(new AppError(ErrorCode.VerificationCodeExpired));
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationCode: null,
        emailVerificationExpires: null,
      },
    });

    res.json({
      success: true,
      message: '邮箱验证成功，您现在可以登录了',
    });
  } catch (error) {
    next(error);
  }
};

export const resendVerificationCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new AppError(ErrorCode.InvalidRequest, '邮箱不能为空'));
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.deletedAt) {
      return next(new AppError(ErrorCode.NotFound, '用户不存在'));
    }

    if (user.isEmailVerified) {
      return next(new AppError(ErrorCode.InvalidRequest, '邮箱已验证，无需重复发送'));
    }

    // 生成新的 6 位数字验证码
    const verificationCode = generateNumericCode(6);
    const verificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationCode: verificationCode,
        emailVerificationExpires: verificationExpires,
      },
    });

    // 发送验证邮件
    try {
      await mailService.sendVerificationEmail(email, verificationCode, EMAIL_VERIFICATION_EXPIRY_HOURS);
    } catch (mailError) {
      console.error('Failed to resend verification email:', mailError);
      return next(new AppError(ErrorCode.InternalError, '发送邮件失败，请稍后再试'));
    }

    res.json({
      success: true,
      message: '验证码已重发，请检查您的邮箱',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 发送登录验证码（免注册：不存在的用户自动创建）
 * POST /auth/send-login-code
 */
export const sendLoginCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email || !validateEmail(email)) {
      return next(new AppError(ErrorCode.InvalidEmail));
    }

    let user = await prisma.user.findUnique({ where: { email } });

    // 已注销用户，不暴露是否存在，统一返回成功
    if (user?.deletedAt) {
      return res.json({
        success: true,
        message: '如果邮箱已注册，验证码将发送至您的邮箱',
      });
    }

    // 检查冷却时间，防止频繁发送（每 60 秒最多发一次）
    if (user?.loginCodeExpires) {
      const elapsedSeconds = (Date.now() - user.loginCodeExpires.getTime()) / 1000;
      const timeSinceLastSend = elapsedSeconds + LOGIN_CODE_EXPIRY_MINUTES * 60;
      const cooldownRemaining = LOGIN_CODE_COOLDOWN_SECONDS - timeSinceLastSend;
      if (cooldownRemaining > 0) {
        return next(new AppError(ErrorCode.LoginCodeRateLimit));
      }
    }

    // 生成 6 位登录验证码
    const loginCode = generateNumericCode(6);
    const loginCodeExpires = new Date(Date.now() + LOGIN_CODE_EXPIRY_MINUTES * 60 * 1000);

    if (!user) {
      // 免注册：自动创建用户（无密码，未验证邮箱由验证码登录时一并完成验证）
      user = await prisma.user.create({
        data: {
          email,
          role: Role.CUSTOMER,
          loginCode,
          loginCodeExpires,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginCode,
          loginCodeExpires,
        },
      });
    }

    // 发送登录验证码邮件
    try {
      await mailService.sendLoginCodeEmail(email, loginCode, LOGIN_CODE_EXPIRY_MINUTES);
    } catch (mailError) {
      console.error('Failed to send login code email:', mailError);
      // 自动创建的用户如果发邮件失败，删除之以便下次重试
      if (user && !user.name && !user.password && !user.isEmailVerified) {
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      }
      return next(new AppError(ErrorCode.InternalError, '发送验证码失败，请稍后重试'));
    }

    res.json({
      success: true,
      message: '验证码已发送至您的邮箱，请查收',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 验证码登录（免注册：首次验证码登录同时完成邮箱验证）
 * POST /auth/login-by-code
 */
export const loginByCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return next(new AppError(ErrorCode.InvalidRequest, '邮箱和验证码不能为空'));
    }

    if (!validateEmail(email)) {
      return next(new AppError(ErrorCode.InvalidEmail));
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return next(new AppError(ErrorCode.InvalidCredentials, '邮箱或验证码错误'));
    }

    if (user.deletedAt) {
      return next(new AppError(ErrorCode.AccountDeleted));
    }

    if (!user.loginCode || user.loginCode !== code) {
      return next(new AppError(ErrorCode.LoginCodeInvalid));
    }

    if (user.loginCodeExpires && user.loginCodeExpires < new Date()) {
      return next(new AppError(ErrorCode.LoginCodeExpired));
    }

    // 登录成功：清除验证码，同时标记邮箱已验证（免注册用户首次登录即验证）
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginCode: null,
        loginCodeExpires: null,
        isEmailVerified: true,
        emailVerificationCode: null,
        emailVerificationExpires: null,
      },
    });

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

    // 检查邮箱是否已验证
    if (!user.isEmailVerified) {
      return next(new AppError(ErrorCode.EmailNotVerified));
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

/**
 * 管理员接口：更新用户角色
 */
export const updateUserRole = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const targetUserId = parseInt(req.params.id as string);
    const role = mapToEnum(req.body.role, Role);

    if (isNaN(targetUserId)) {
      return next(new AppError(ErrorCode.InvalidRequest, '无效的用户 ID'));
    }

    if (!role) {
      return next(new AppError(ErrorCode.InvalidRequest, '无效的角色类型'));
    }

    // 检查目标用户是否存在
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return next(new AppError(ErrorCode.NotFound, '目标用户不存在'));
    }

    const updatedUser = await userService.updateUserRole(targetUserId, role as any);

    res.json({
      success: true,
      message: '用户角色更新成功',
      data: formatUser(updatedUser),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取用户列表 (仅管理员可用)
 */
export const listUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    
    let role: Role | undefined = undefined;
    if (req.query.role) {
      role = mapToEnum(req.query.role, Role);
      if (!role) {
        return next(new AppError(ErrorCode.InvalidRequest, '无效的角色参数'));
      }
    }

    const { list, pagination } = await userService.getUsers({
      page,
      limit,
      search,
      role,
    });

    res.json({
      success: true,
      data: {
        list: list.map(formatUser),
        pagination,
      },
    });
  } catch (error) {
    next(error);
  }
};
