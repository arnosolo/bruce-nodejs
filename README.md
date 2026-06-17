# 聪明小黄后端

AI 客服后端, 支持回复常见问题和修改用户资料.

## 技术栈

- 运行时: Node.js
- 框架: Express.js
- 语言: TypeScript
- ORM: Prisma 7
- 数据库: PostgreSQL
- 文件存储: 阿里云 OSS
- AI Agent: LangChain
- 向量库: pgvector
- 进程管理: PM2
- 反向代理: Nginx

## 开发

### 项目初始化

#### 创建 .env

复制 `.env.example ` 为 `.env`

#### 配置 AI

1. 申请 AI API Key. 如果本机性能允许, 也可以下载 Ollama 本地模型.
2. 在 `.env` 文件中填写 AI 信息

#### 创建阿里云 OSS

1. 阿里云 → RAM 控制台 → 创建用户
2. 给用户授权：AliyunOSSFullAccess
3. 拿到：AccessKeyId / AccessKeySecret
4. OSS 控制台创建 Bucket，记下：
   - Bucket 名
   - 地域（如 oss-cn-hangzhou）
5. 由于当前项目公开文件和私有文件放在一个存储桶中, 所以需要更新授权策略.在阿里云 OSS 控制台 权限管理 → Bucket 授权策略 添加
   ```json
   {
   "Version": "1",
   "Statement": [
      {
         "Effect": "Allow",
         "Principal": "*",
         "Action": [
         "oss:GetObject"
         ],
         "Resource": [
         "acs:oss:*:*:你的bucket/public/*"
         ]
      }
   ]
   }
   ```
6. 在 `.env` 文件中填写 OSS 信息

#### 创建数据库

1. 在 PostgreSQL 中创建数据库
```sh
psql -U luna -d postgres -h localhost
# -U 登录用户 -d 数据库名称 -h 主机地址
```
2. 在 `.env` 文件中填写数据库连接信息

#### 安装 pgvector

> https://github.com/pgvector/pgvector

官方文档推荐编译安装, 但是我这边没有 `C` 编译工具链接, 试试用 `apt` 安装
1. 查看 PG 版本
```sh
psql --version
# psql (PostgreSQL) 17.10 (Debian 17.10-0+deb13u1)
```

2. 安装
```sh
sudo apt update
sudo apt install -y postgresql-17-pgvector
```

装好了, 再根据文档要求启用 extension.
> https://github.com/pgvector/pgvector#getting-started

1. 进入 psql 命令行
```sh
psql -U postgres -d ai_cs -h localhost
```
2. 执行安装扩展
```sql
CREATE EXTENSION vector;
```
3. 验证安装. 能查到结果 = 安装成功
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

#### 安装依赖

```bash
npm install
```

#### 数据库迁移

1. 生成 Prisma Client:
   ```bash
   npx prisma generate
   ```

2. 运行数据库迁移:
   ```bash
   npx prisma migrate dev
   ```

#### 运行开发服务器

```bash
npm run dev
```

### 目录结构

- src/: 源代码目录
  - index.ts: 程序入口
  - lib/prisma.ts: Prisma Client 实例化逻辑 (包含 PostgreSQL 适配器配置)
- prisma/: Prisma 配置与 Schema
- generated/: 自动生成的 Prisma Client 代码 (已在 .gitignore 中忽略)
- prisma.config.ts: Prisma 7 配置文件

### 更新数据库 Schema

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

## 手动部署

本项目前后端分离, 前端存放在阿里云 OSS, 后端部署在阿里云 ECS. 在生产服务器上部署时，请遵循以下流程:

### 首次部署

#### 下载代码

如果当前代码库尚未开源, 可以使用 SSH 密钥方式下载代码

#### 创建 .env

复制 `.env.example ` 为 `.env`

#### 配置 AI

1. 申请 AI API Key. 如果本机性能允许, 也可以下载 Ollama 本地模型.
2. 在 `.env` 文件中填写 AI 信息

#### 创建阿里云 OSS

同`开发` > `项目初始化` > `创建阿里云 OSS` 章节

#### 创建数据库

同`开发` > `项目初始化` > `创建数据库` 章节

#### 安装 pgvector

同`开发` > `项目初始化` > `安装 pgvector` 章节

#### 安装依赖

1. 安装 Node. 参考 https://nodejs.org/en/download
2. 安装依赖.
```bash
npm install
```

#### 数据库迁移

1. 生成最新 Prisma Client（重要！）
```bash
npx prisma generate
```

2. 执行数据库迁移
```bash
npx prisma migrate deploy
```
*原因：生产环境应使用 `deploy` 而非 `dev`。它仅执行未应用的迁移文件，不会重置数据库，确保数据安全。*

#### 编译项目

```bash
npm run build
```

#### PM2 持久运行服务

1. 安装 PM2
```bash
npm install -g pm2
# 常用PM2命令
pm2 list          # 查看运行进程
pm2 restart node-service  # 重启
pm2 stop node-service     # 停止
pm2 logs node-service     # 查看日志
```
2. 运行服务
```bash
cd /www/bruce-nodejs
pm2 start ecosystem.config.cjs
# 备选方案 pm2 start dist/index.js --name "bruce-nodejs"
```
3. 生成开机启动脚本
```sh
pm2 startup
```
4. 把最新进程状态写入快照(服务器重启的时候 pm2 会读取快照来重启服务)
```sh
pm2 save
```
5. 验证
```sh
reboot
# 重启后执行
pm2 list
```

#### 域名备案

可以在阿里云完成 ICP 备案, 一般需要至少 7 天. 在域名备案完成之前, 只能使用 IP 进行访问.

#### 域名解析

在阿里云域名解析, 创建一条 `A` 记录, 将域名指向服务器 IP.

#### 上传 SSL 证书

在阿里云数字证书管理服务, 可以下载到免费证书. 记得把证书上传到服务器上, 路径取决于 Nginx 配置. 
注意! 免费证书有效期只有 90天, 到时间了需要重新上传.
```bash
scp -i ~/.ssh/你的私钥.pem api.ai-cs.space.pem api.ai-cs.space.key root@服务器IP:/etc/nginx/ssl/
```

#### Nginx 配置

修改 Nginx 配置

```sh
vim /etc/nginx/sites-available/default
```

```sh
# HTTP 80 端口：全部重定向到 HTTPS
server {
    listen 80;
    server_name api.ai-cs.space;

    # 永久重定向 301
    return 301 https://$host$request_uri;
}

# HTTPS 443 端口 + SSL 证书配置（纯后端API，无静态资源）
server {
    listen 443 ssl;
    server_name api.ai-cs.space;

    # ========== SSL 证书路径（修改为你实际文件路径） ==========
    ssl_certificate      /etc/nginx/ssl/api.ai-cs.space.pem;
    ssl_certificate_key  /etc/nginx/ssl/api.ai-cs.space.key;

    # 基础 SSL 优化配置（阿里云通用推荐）
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:HIGH:!aNULL:!MD5:!RC4:!DHE;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 移除 root、index、Vue静态路由，只做API反向代理
    location / {
        # 全部请求转发后端，不需要拼接/api，后端自行处理路由前缀
        proxy_pass http://127.0.0.1:3000;
        
        # 透传客户端信息
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时配置（可选优化，防止长接口超时断开）
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

重启 Nginx
```sh
systemctl reload nginx && systemctl status nginx
```

### 再次部署

```bash
# 进入项目目录
cd /www/bruce-nodejs

# 拉取最新代码
git pull origin main

# 安装所有依赖（包含 devDependencies，TS编译需要）
npm install

# 1. TypeScript 编译
npm run build

# 2. Prisma 生产迁移 + 生成客户端
npx prisma migrate deploy
npx prisma generate

# 3. PM2 重启/启动服务
pm2 restart ecosystem.config.cjs || pm2 start ecosystem.config.cjs

# 把最新进程状态写入快照(服务器重启的时候 pm2 会读取快照来重启服务)
pm2 save
```

## 自动部署

使用 `Github Actions` 实现自动部署, 具体实现见配置文件 `.github/workflows/`.

## 资源

### 源码

- [Node.js 后端](https://github.com/arnosolo/ai-customer-service)
- [Web 前端](https://github.com/arnosolo/ai-customer-service-vue)

### 参考文档

- [Prisma PostgreSQL 快速入门](https://www.prisma.io/docs/prisma-orm/quickstart/postgresql)
