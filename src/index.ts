import express, { Request, Response } from 'express';
import { prisma } from './lib/prisma.js';
import "dotenv/config";
import { setupSwagger } from './lib/swagger.js';
import healthRouter from './routes/health.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Setup Swagger UI
setupSwagger(app);

app.get('/', (req: Request, res: Response) => {
  res.redirect('/api-docs');
});

app.use('/health', healthRouter);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
