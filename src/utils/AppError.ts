export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;

  constructor(message: string, statusCode: number, errorCode: string) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    
    // 显式修复原型链，确保 instanceof AppErrorError 能正常工作
    // 在 ES5 中, 如果不加这行 AppError 会被当作普通 Error 处理
    // 如果你在 tsconfig.json 中设置 "target": "ES6"（或更高），
    // 现代浏览器和 Node.js 其实已经原生支持了类继承，
    // 这时候 super() 会正确处理 this 指向，不再严格需要这行代码。
    // 但为了向后兼容性和代码健壮性，社区普遍习惯保留这行代码。
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
