import OSS from 'ali-oss';
import { AppError } from '../utils/AppError.js';
import { ErrorCode } from '../constants/errorCodes.js';

/**
 * 阿里云 OSS 配置校验
 */
const getOSSConfig = () => {
  const {
    OSS_REGION,
    OSS_BUCKET,
    OSS_ACCESS_KEY_ID,
    OSS_ACCESS_KEY_SECRET,
  } = process.env;

  if (!OSS_REGION || !OSS_BUCKET || !OSS_ACCESS_KEY_ID || !OSS_ACCESS_KEY_SECRET) {
    throw new AppError(ErrorCode.ConfigError, 'OSS 配置缺失');
  }

  return {
    region: OSS_REGION,
    bucket: OSS_BUCKET,
    accessKeyId: OSS_ACCESS_KEY_ID,
    accessKeySecret: OSS_ACCESS_KEY_SECRET,
    secure: true,
  };
};

/**
 * 获取 OSS 客户端实例
 */
const getClient = () => {
  const config = getOSSConfig();
  return new OSS(config);
};

/**
 * 生成前端 PostObject 上传签名 (可限制文件大小)
 * @param key 文件在 OSS 中的路径
 * @param maxSize 允许的最大文件尺寸 (字节)
 */
export const getPostObjectSignature = (key: string, maxSize = 10 * 1024 * 1024) => {
  const client = getClient();
  const config = getOSSConfig();
  
  // 设置过期时间 (10分钟)
  const expiration = new Date();
  expiration.setMinutes(expiration.getMinutes() + 10);

  // 策略定义
  const policy = {
    expiration: expiration.toISOString(),
    conditions: [
      ['content-length-range', 0, maxSize], // 限制文件大小
      ['eq', '$key', key], // 限制上传路径必须一致
    ],
  };

  // 生成签名
  const params = client.calculatePostSignature(JSON.stringify(policy));

  return {
    host: `https://${config.bucket}.${config.region}.aliyuncs.com`,
    policy: params.policy,
    signature: params.Signature,
    accessId: params.OSSAccessKeyId,
    key,
  };
};

/**
 * 生成访问私有文件的 GET 签名 URL
 * @param key 文件路径
 */
export const getDownloadUrl = (key: string | null | undefined) => {
  if (!key) return null;
  const client = getClient();
  return client.signatureUrl(key, {
    expires: 3600, // 1小时有效
  });
};
