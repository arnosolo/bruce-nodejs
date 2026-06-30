/**
 * 错误码定义
 */
export const ErrorCode = {
  // 认证相关
  InvalidEmail: 'AUTH_001',
  PasswordTooSimple: 'AUTH_002',
  UserAlreadyExists: 'AUTH_003',
  InvalidCredentials: 'AUTH_004',
  Unauthorized: 'AUTH_005',
  InvalidOldPassword: 'AUTH_006',
  AccountDeleted: 'AUTH_007',
  EmailNotVerified: 'AUTH_008',
  InvalidVerificationCode: 'AUTH_009',
  VerificationCodeExpired: 'AUTH_010',
  LoginCodeRateLimit: 'AUTH_011',
  LoginCodeExpired: 'AUTH_012',
  LoginCodeInvalid: 'AUTH_013',
  UserNotFound: 'AUTH_014',
  
  // 请求相关
  InvalidRequest: 'REQ_001',
  NotFound: 'REQ_002',
  Forbidden: 'REQ_003',
  
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
  [ErrorCode.Unauthorized]: { 
    message: '请先登录', 
    status: 401 
  },
  [ErrorCode.InvalidOldPassword]: { 
    message: '旧密码错误', 
    status: 400 
  },
  [ErrorCode.AccountDeleted]: { 
    message: '该账号已注销', 
    status: 403 
  },
  [ErrorCode.EmailNotVerified]: { 
    message: '邮箱未验证，请先验证您的邮箱', 
    status: 403 
  },
  [ErrorCode.InvalidVerificationCode]: { 
    message: '验证码无效', 
    status: 400 
  },
  [ErrorCode.VerificationCodeExpired]: { 
    message: '验证码已过期', 
    status: 400 
  },
  [ErrorCode.LoginCodeRateLimit]: {
    message: '请求过于频繁，请60秒后再试',
    status: 429
  },
  [ErrorCode.LoginCodeExpired]: {
    message: '登录验证码已过期，请重新获取',
    status: 400
  },
  [ErrorCode.LoginCodeInvalid]: {
    message: '登录验证码错误',
    status: 400
  },
  [ErrorCode.UserNotFound]: {
    message: '该邮箱未注册',
    status: 404
  },

  // --- 请求相关 ---
  [ErrorCode.InvalidRequest]: { 
    message: '请求参数有误', 
    status: 400 
  },
  [ErrorCode.NotFound]: { 
    message: '资源不存在', 
    status: 404 
  },
  [ErrorCode.Forbidden]: { 
    message: '拒绝访问', 
    status: 403 
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
