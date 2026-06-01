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
For the definitive schema, please refer to `prisma/schema.prisma`.

## AI Service & Features
### Multi-Provider Support
The AI service supports multiple providers (Google Gemini, OpenAI, Qwen, Ollama) via environment configuration (`AI_PROVIDER`).

### Automatic Conversation Titling
Conversations are automatically summarized and titled by the AI to improve UX.
- **State-Driven**: Uses the `isTitleGenerated` flag in the database, allowing the `title` field itself to be `null` or localized.
- **Trigger Strategy**:
    - Triggers after 2 messages if the user's message is > 10 characters.
    - Triggers after 4 messages (2 full turns) regardless of length.
- **Robustness**: Employs a "silent retry" strategy—if summarization fails, it returns `null` and will be re-attempted during the next message exchange until `isTitleGenerated` is set to `true`.

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
- **API Standards**:
    - **Naming Convention**: Use `camelCase` for all JSON keys (both request and response).
    - **Success Wrapper**: 
        - Data returning: `{ success: true, data: { ... } }`
        - Action success: `{ success: true, message: "Operation description" }`
    - **Error Wrapper**: (Handled by `errorHandler`)
        - Structure: `{ success: false, message: "Error description", errorCode: "CODE" }`
    - **Paginated List Style**:
        - **Parameters**: Use `page` (start at 1) and `limit`.
        - **Structure**:
          ```json
          {
            "success": true,
            "data": {
              "list": [],
              "pagination": { "total": 0, "page": 1, "limit": 10, "totalPages": 0 }
            }
          }
          ```
    - **DateTime**: Use `ISO 8601` string format (e.g., `2024-05-22T10:00:00Z`).
    - **HTTP Status Codes**:
        - `200`: Success (Read/Update/Delete)
        - `201`: Created (Success Create)
        - `400`: Bad Request (Validation errors)
        - `401`: Unauthorized (Not logged in)
        - `403`: Forbidden (No permission / Account deleted)
        - `404`: Not Found
        - `500`: Internal Server Error

