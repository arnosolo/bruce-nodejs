import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { ErrorCode } from '../constants/errorCodes.js';
import { AuthRequest } from '../middlewares/auth.js';
import { MessageRole } from '../../generated/prisma/client.js';
import * as aiService from '../services/ai.service.js';

/**
 * 获取会话列表 (支持 Offset 分页)
 */
export const getConversations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(new AppError(ErrorCode.Unauthorized));
    }

    // 分页参数：page 默认为 1，limit 默认为 20
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [total, conversations] = await Promise.all([
      prisma.conversation.count({ where: { userId, deletedAt: null } }),
      prisma.conversation.findMany({
        where: {
          userId,
          deletedAt: null,
        },
        skip,
        take: limit,
        orderBy: {
          updatedAt: 'desc',
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        list: conversations,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 创建新会话
 */
export const createConversation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(new AppError(ErrorCode.Unauthorized));
    }

    const { title } = req.body;

    const conversation = await prisma.conversation.create({
      data: {
        title: title || '新会话',
        userId,
      },
    });

    res.status(201).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取会话消息记录 (支持 Cursor 游标分页)
 */
export const getMessages = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const conversationId = parseInt(req.params.id as string);

    if (isNaN(conversationId)) {
      return next(new AppError(ErrorCode.InvalidRequest, '无效的会话ID'));
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.deletedAt) {
      return next(new AppError(ErrorCode.NotFound));
    }

    if (conversation.userId !== userId) {
      return next(new AppError(ErrorCode.Forbidden));
    }

    // 游标参数：cursor 为最后一条消息的 ID，limit 默认为 50
    const cursorId = req.query.cursor ? parseInt(req.query.cursor as string) : undefined;
    const limit = parseInt(req.query.limit as string) || 50;

    const messages = await prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: {
          select: { name: true },
        },
      },
      take: limit,
      skip: cursorId ? 1 : 0, // 如果有游标，跳过游标本身
      cursor: cursorId ? { id: cursorId } : undefined,
      orderBy: { createdAt: 'asc' }, // 聊天记录通常按时间升序展示
    });

    res.json({
      success: true,
      data: {
        list: messages,
        nextCursor: messages.length === limit ? messages[messages.length - 1].id : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 发送消息并获取 AI 回复
 */
export const sendMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const conversationId = parseInt(req.params.id as string);
    const { content } = req.body;

    if (isNaN(conversationId) || !content) {
      return next(new AppError(ErrorCode.InvalidRequest));
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.deletedAt) {
      return next(new AppError(ErrorCode.NotFound));
    }

    if (conversation.userId !== userId) {
      return next(new AppError(ErrorCode.Forbidden));
    }

    // 1. 保存用户发送的消息
    const userMessage = await prisma.message.create({
      data: {
        content,
        role: MessageRole.USER,
        conversationId,
        senderId: userId, // 记录发送者ID
      },
      include: {
        sender: {
          select: { name: true },
        },
      },
    });

    // 2. 获取 AI 回复 (AI 会自动从数据库历史记录中读取刚才保存的消息)
    const aiContent = await aiService.generateAgentResponse(conversationId, userId);
    
    // 3. 将 AI 回复存入数据库
    const aiMessage = await prisma.message.create({
      data: {
        content: aiContent,
        role: MessageRole.ASSISTANT,
        conversationId,
        // senderId 为空表示系统或 AI 生成
      },
      include: {
        sender: {
          select: { name: true },
        },
      },
    });

    // 4. 更新会话的最后活跃时间，以便列表排序
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    res.json({
      success: true,
      data: {
        userMessage,
        aiMessage,
      },
    });
  } catch (error) {
    next(error);
  }
};
