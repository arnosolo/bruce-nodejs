/**
 * 错误码定义
 * Key: 用于代码调用 (PascalCase)，视觉舒适
 * Value: 用于协议传输 (SCREAMING_SNAKE_CASE)，醒目且符合传统规范
 */
export const ErrorCode = {
  // 认证相关
  InvalidEmail: 'INVALID_EMAIL',
  PasswordTooSimple: 'PASSWORD_TOO_SIMPLE',
  UserAlreadyExists: 'USER_ALREADY_EXISTS',
  InvalidCredentials: 'INVALID_CREDENTIALS',
  
  // 系统相关
  InternalError: 'INTERNAL_ERROR',
  ConfigError: 'CONFIG_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * 配置项的结构定义
 */
interface ErrorConfigItem {
  readonly message: string;
  readonly status: number;
}

/**
 * 错误配置映射
 */
export const ErrorConfig: Record<ErrorCode, ErrorConfigItem> = {
  // --- 认证相关 ---
  [ErrorCode.InvalidEmail]: { 
    message: '邮箱格式不正确', 
    status: 400 
  },
  [ErrorCode.PasswordTooSimple]: { 
    message: '密码太简单，需至少8位且包含大小写字母和数字', 
    status: 400 
  },
  [ErrorCode.UserAlreadyExists]: { 
    message: '该用户已存在', 
    status: 409 
  },
  [ErrorCode.InvalidCredentials]: { 
    message: '用户名或密码错误', 
    status: 401 
  },

  // --- 系统相关 ---
  [ErrorCode.InternalError]: { 
    message: '服务器内部错误', 
    status: 500 
  },
  [ErrorCode.ConfigError]: { 
    message: '系统配置异常', 
    status: 500 
  },
} as const;
