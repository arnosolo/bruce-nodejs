import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { ErrorCode } from '../constants/errorCodes.js';
import { AuthRequest } from '../middlewares/auth.js';
import { MessageRole, MessageType } from '../../generated/prisma/client.js';
import * as aiService from '../services/ai.service.js';
import * as ossService from '../services/oss.service.js';

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
        title: title || null,
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

    // 为附件生成私密下载链接
    const messagesWithUrls = messages.map(msg => ({
      ...msg,
      url: msg.attachmentKey ? ossService.getDownloadUrl(msg.attachmentKey) : null,
    }));

    res.json({
      success: true,
      data: {
        list: messagesWithUrls,
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
    const { content, type, attachmentKey } = req.body;

    if (isNaN(conversationId) || (!content && !attachmentKey)) {
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
        content: content || '',
        type: (type as MessageType) || MessageType.TEXT,
        attachmentKey: attachmentKey || null,
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
    // console.log('aiMessage saved');

    // 4. 更新会话更新时间
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    res.json({
      success: true,
      data: {
        userMessage: {
          ...userMessage,
          url: userMessage.attachmentKey ? ossService.getDownloadUrl(userMessage.attachmentKey) : null,
        },
        aiMessage,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 流式发送消息并获取 AI 回复 (SSE)
 */
export const streamSendMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    await prisma.message.create({
      data: {
        content,
        role: MessageRole.USER,
        conversationId,
        senderId: userId,
      },
    });

    // 2. 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullAIContent = '';

    // 3. 开始流式输出
    try {
      const stream = aiService.streamAgentResponse(conversationId, userId);
      
      // 用于去重的上一次内容（针对某些累计输出的 Stream）
      let lastYieldedContent = '';

      for await (const chunk of stream) {
        // 这里的 chunk 处理取决于 Service 层产出的是增量还是全量
        // 如果是全量累计，我们需要计算增量
        const delta = chunk.startsWith(lastYieldedContent) 
          ? chunk.slice(lastYieldedContent.length) 
          : chunk;
        
        if (delta) {
          fullAIContent = chunk; // 保持最新的全量内容用于后续保存
          lastYieldedContent = chunk;
          
          // 按照 SSE 格式发送数据
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }
      }
    } catch (streamError) {
      console.error("Streaming error:", streamError);
      res.write(`data: ${JSON.stringify({ error: "AI response interrupted" })}\n\n`);
    }

    // 4. 流结束后，保存 AI 完整回复到数据库
    if (fullAIContent) {
      await prisma.message.create({
        data: {
          content: fullAIContent,
          role: MessageRole.ASSISTANT,
          conversationId,
        },
      });

      // 更新会话更新时间
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    }

    res.write('event: end\ndata: [DONE]\n\n');
    res.end();
  } catch (error) {
    // 如果还没开始发送流就报错了，走统一错误处理
    if (!res.headersSent) {
      next(error);
    } else {
      res.end();
    }
  }
};

/**
 * 手动或根据策略触发会话标题生成/总结
 */
export const summarizeTitle = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const conversationId = parseInt(req.params.id as string);

    if (isNaN(conversationId)) {
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

    // 调用 AI 服务生成标题 (失败会抛出异常被 catch 捕获)
    const newTitle = await aiService.summarizeConversationTitle(conversationId);
    
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        title: newTitle,
        isTitleGenerated: true,
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: {
        title: newTitle,
      },
    });
  } catch (error) {
    next(error);
  }
};
