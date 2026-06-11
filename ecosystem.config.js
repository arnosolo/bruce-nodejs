/*
 * PM2 启动配置
 */
module.exports = {
  apps: [
    {
      name: "bruce-nodejs",
      script: "./dist/index.js",
      exec_mode: "fork",
      instances: 1,

      env: {
        NODE_ENV: "production"
      },

      // 内存上限，超出自动重启（单位 MB）
      max_memory_restart: "512M",
      // 异常退出自动重启
      autorestart: true,
      // 启动后等待多久才算正常运行
      wait_ready: false,
      // 最大重启次数
      max_restarts: 10,

      // 日志
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    }
  ]
};

