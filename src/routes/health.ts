import { Router, Request, Response, NextFunction } from 'express';
import { APP_VERSION } from '../constants/version.js';

const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Basic check to see if prisma is connected
    // This will fail until you run migrations and have a database
    // await prisma.$connect();
    res.json({
      success: true,
      message: '服务运行正常',
      data: {
        status: 'OK',
        version: APP_VERSION,
        database: 'connected (simulated)'
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
