# Project Overview
This project is an **AI Customer Service API** built with **Node.js**, **Express**, and **TypeScript**. It uses **Prisma 7** as an ORM with **PostgreSQL** for data persistence. The primary goal is to manage customer information and service tickets efficiently.

## Core Technologies
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Framework:** [Express.js](https://expressjs.com/)
- **ORM:** [Prisma 7](https://www.prisma.io/)
- **Database:** [PostgreSQL](https://www.postgresql.org/) (configured via `prisma.config.ts` and `src/index.ts` adapter)
- **Development Tools:** `nodemon`, `ts-node`

## Project Structure
- `src/`: Main source directory.
    - `index.ts`: Entry point of the application (includes Prisma adapter setup).
- `prisma/`: Database configuration.
    - `schema.prisma`: Data models (datasource URL is managed via adapter).
- `dist/`: Compiled JavaScript output (ignored by git).
- `prisma.config.ts`: Central Prisma configuration for migrations.


## Data Models
- **User**: Represents a client in the system.
    - `id`: Unique identifier.
    - `email`: Unique email address.
    - `password`: Hashed password.
    - `name`: Optional name.

## Building and Running
### Development
To start the development server with hot-reloading:
```bash
npm run dev
```

### Build
To compile the TypeScript source into JavaScript:
```bash
npm run build
```

### Production
To run the compiled application:
```bash
npm start
```

### Database Operations
- **Generate Client:** `npx prisma generate`
- **Create/Run Migrations:** `npx prisma migrate dev`
- **Open Studio:** `npx prisma studio`

## Development Conventions
- **Strict Typing:** Always use TypeScript's strict mode (as configured in `tsconfig.json`).
- **Environment Variables:** Use a `.env` file for local configuration (e.g., `DATABASE_URL`).
- **Prisma 7 Configuration:** The `datasource` URL in `schema.prisma` is removed. Runtime connections use `@prisma/adapter-pg` with a `pg` pool. Migrations use the URL defined in `prisma.config.ts`.
- **Graceful Shutdown:** The server handles `SIGTERM` to close database connections properly.
- **API Responses:** Follow standard JSON response patterns.
