import { ErrorCode, ErrorConfig } from '../constants/errorCodes.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCode;

  /**
   * 升级后的构造函数
   * @param code - 我们定义的 ErrorCode (例如 ErrorCode.InvalidEmail)
   * @param customMessage - (可选) 覆盖默认的错误消息
   */
  constructor(code: ErrorCode, customMessage?: string) {
    // 1. 从配置表中获取默认配置
    const config = ErrorConfig[code];
    
    // 2. 确定最终的消息和状态码
    const finalMessage = customMessage || config?.message || 'Internal Server Error';
    const finalStatus = config?.status || 500;

    // 3. 调用父类 Error
    super(finalMessage);

    this.statusCode = finalStatus;
    this.errorCode = code;

    // 4. 健壮性处理
    // 显式修复原型链，确保 instanceof AppErrorError 能正常工作
    // 在 ES5 中, 如果不加这行 AppError 会被当作普通 Error 处理
    // 如果你在 tsconfig.json 中设置 "target": "ES6"（或更高），
    // 现代浏览器和 Node.js 其实已经原生支持了类继承，
    // 这时候 super() 会正确处理 this 指向，不再严格需要这行代码。
    // 但为了向后兼容性和代码健壮性，社区普遍习惯保留这行代码。
    Object.setPrototypeOf(this, AppError.prototype);
    
    // 捕获堆栈跟踪，并在堆栈中隐藏构造函数本身的调用
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
