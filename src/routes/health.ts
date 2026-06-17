import { Router, Request, Response, NextFunction } from 'express';
import { APP_VERSION } from '../constants/version.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Basic check to see if prisma is connected
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      success: true,
      message: '服务运行正常',
      data: {
        status: 'OK',
        version: APP_VERSION,
        database: 'connected'
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
