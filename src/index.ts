import express, { Request, Response } from 'express';
import cors from 'cors';
import { prisma } from './lib/prisma.js';
import "dotenv/config";
import { setupSwagger } from './lib/swagger.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import conversationRouter from './routes/conversation.js';
import ossRouter from './routes/oss.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { logger } from './utils/logger.js';
import morgan from 'morgan';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
}));
app.use(express.json());

// Setup Swagger UI
setupSwagger(app);

// HTTP 请求日志（morgan + winston 结合）
app.use(morgan('tiny', {
  stream: { write: (message: string) => logger.info(message.trim()) }
}));

app.get('/', (req: Request, res: Response) => {
  res.redirect('/api-docs');
});

// 路由注册
app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/conversations', conversationRouter); // 会话与聊天路由
app.use('/oss', ossRouter); // OSS 相关路由

// 全局错误处理中间件
app.use(errorHandler);

app.listen(port, () => {
  logger.log({ level: 'info', message: `Server is running on http://localhost:${port}`})
  // console.log(`Server is running on http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
