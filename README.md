# 聪明小黄后端

这是一个基于 Node.js、Express 和 TypeScript 开发的后端项目。数据库使用 PostgreSQL，并采用 Prisma 7 作为 ORM。

## 技术栈

- 运行时: Node.js
- 框架: Express.js
- 语言: TypeScript
- ORM: Prisma 7 (使用 prisma-client 生成器和驱动适配器)
- 数据库: PostgreSQL

## 项目初始化

1. 安装依赖:
   ```bash
   npm install
   ```

2. 在运行初始化脚本之前，请确保您已经在 PostgreSQL 中创建了数据库。
   **数据库配置参考（使用 psql）：**
   ```sql
   -- 登录 PostgreSQL (根据您的环境调整参数)
   psql -U luna -d postgres -h localhost

   -- 参数说明：
   -- -U luna: 指定登录用户 (User) 为 luna
   -- -d postgres: 指定连接的默认数据库 (Database) 为 postgres
   -- -h localhost: 指定主机地址 (Host) 为本地 localhost
   ```

   **常用 psql 命令：**
   - `\l`: 列出所有数据库。
   - `\c 数据库名`: 切换到指定的数据库。
   - `\dt`: 列出当前数据库中的所有表。
   - `\q`: 退出 psql。

3. 配置环境变量:
   复制 .env.example 为 .env 并配置数据库连接字符串：
   ```bash
   cp .env.example .env
   ```
   然后编辑 .env 文件：
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/db_name?schema=public"
   PORT=3000
   ```

4. 生成 Prisma Client:
   ```bash
   npx prisma generate
   ```

5. 运行数据库迁移:
   ```bash
   npx prisma migrate dev
   ```

## 开发与运行

- 开发模式 (热重载):
  ```bash
  npm run dev
  ```

- 编译项目:
  ```bash
  npm run build
  ```

- 生产环境运行:
  ```bash
  npm start
  ```

## 数据库 Schema 更新

如果您修改了 `prisma/schema.prisma` 中的数据模型，请按照以下步骤更新数据库：

1. **生成并应用迁移：**
   ```bash
   npx prisma migrate dev --name <migration_name>
   ```
   此命令会创建一个新的迁移文件，将其应用到数据库，并自动重新生成 Prisma Client。

2. **仅更新 Prisma Client：**
   如果您只需要更新 TypeScript 类型定义（例如在拉取了包含新迁移的代码后），可以运行：
   ```bash
   npx prisma generate
   ```

## 生产环境部署

在生产服务器上部署时，请遵循以下流程：

1. **编译项目：**
   ```bash
   npm run build
   ```
   *原因：Node.js 无法直接运行 TS。编译会将代码转换为高性能的 JS 并存放在 `dist` 目录。*

2. **同步数据库（部署迁移）：**
   ```bash
   npx prisma migrate deploy
   ```
   *原因：生产环境应使用 `deploy` 而非 `dev`。它仅执行未应用的迁移文件，不会重置数据库，确保数据安全。*

3. **启动服务：**
   ```bash
   npm start
   ```
   *原因：运行编译后的代码。建议配合 PM2 或 Docker 等工具进行进程管理。*

## 目录结构

- src/: 源代码目录
  - index.ts: 程序入口
  - lib/prisma.ts: Prisma Client 实例化逻辑 (包含 PostgreSQL 适配器配置)
- prisma/: Prisma 配置与 Schema
- generated/: 自动生成的 Prisma Client 代码 (已在 .gitignore 中忽略)
- prisma.config.ts: Prisma 7 配置文件

## 资源

### 源码
https://github.com/arnosolo/ai-customer-service

### 前端
https://github.com/arnosolo/ai-customer-service-vue

### 参考文档

- [Prisma PostgreSQL 快速入门](https://www.prisma.io/docs/prisma-orm/quickstart/postgresql)
