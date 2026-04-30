import { Router } from 'express';
import * as conversationController from '../controllers/conversation.controller.js';
import { authenticate } from '../middlewares/auth.js';

/**
 * 会话与消息相关路由
 * 所有接口均需要 Bearer Token 认证
 */
const router = Router();

// 所有会话路由都需要登录
router.use(authenticate);

router.get('/', conversationController.getConversations);
router.post('/', conversationController.createConversation);
router.get('/:id/messages', conversationController.getMessages);
router.post('/:id/messages', conversationController.sendMessage);

// 流式返回(还有问题)
router.post('/:id/messages/stream', conversationController.streamSendMessage);

// 提取标题总结接口
router.post('/:id/summarize-title', conversationController.summarizeTitle);

export default router;
