import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express, Request, Response } from 'express';

const swaggerJsonPath = '/api/docs-json';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'User Service API',
      version: '1.0.0',
      description: `User service API with Prisma and Express. [Download JSON](${swaggerJsonPath})`,
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development server (v1)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/index.ts',
    './src/routes/*.yaml',
  ], // Path to the API docs
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app: Express) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs));

  // 暴露 Swagger JSON 数据
  app.get(swaggerJsonPath, (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
}
