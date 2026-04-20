/**
 * 错误码定义
 */
export const ErrorCode = {
  // 认证相关
  InvalidEmail: 'AUTH_001',
  PasswordTooSimple: 'AUTH_002',
  UserAlreadyExists: 'AUTH_003',
  InvalidCredentials: 'AUTH_004',
  
  // 系统相关
  InternalError: 'SYS_001',
  ConfigError: 'SYS_002',
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
    message: '系统繁忙，请稍后再试', 
    status: 500 
  },
  [ErrorCode.ConfigError]: { 
    message: '系统配置异常', 
    status: 500 
  },
} as const;
