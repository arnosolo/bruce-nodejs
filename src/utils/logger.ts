import winston from 'winston';

/**
 * Winston 配置文件
 * 1. 生产环境：输出 JSON 到文件 (combined.log, error.log)，包含时间戳和错误堆栈
 * 2. 开发环境：输出着色后的格式化文本到控制台
 */

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }), // 自动捕获并格式化 Error 对象
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-customer-service' },
  transports: [
    // 错误日志单独存储
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // 所有日志存储
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// 开发环境下美化控制台输出
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
        // 打印格式：时间 [级别]: 消息或堆栈 (其他元数据)
        const metaData = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level}: ${stack || message}${metaData}`;
      })
    ),
  }));
}

export { logger };
