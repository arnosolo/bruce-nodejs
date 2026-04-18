import express, { Request, Response } from 'express';
import cors from 'cors';
import { prisma } from './lib/prisma.js';
import "dotenv/config";
import { setupSwagger } from './lib/swagger.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
}));
app.use(express.json());

// Setup Swagger UI
setupSwagger(app);

app.get('/', (req: Request, res: Response) => {
  res.redirect('/api-docs');
});

app.use('/health', healthRouter);
app.use('/auth', authRouter);

// 全局错误处理中间件
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
