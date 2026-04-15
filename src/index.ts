import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to Customer Service API' });
});

app.get('/health', async (req: Request, res: Response) => {
  try {
    // Basic check to see if prisma is connected
    // This will fail until you run migrations and have a database
    // await prisma.$connect();
    res.json({ status: 'OK', database: 'connected (simulated)' });
  } catch (error) {
    res.status(500).json({ status: 'Error', message: (error as Error).message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
