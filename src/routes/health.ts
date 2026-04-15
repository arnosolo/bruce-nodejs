import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    // Basic check to see if prisma is connected
    // This will fail until you run migrations and have a database
    // await prisma.$connect();
    res.json({ status: 'OK', database: 'connected (simulated)' });
  } catch (error) {
    res.status(500).json({ status: 'Error', message: (error as Error).message });
  }
});

export default router;
