import OSS from 'ali-oss';
import { AppError } from '../utils/AppError.js';
import { ErrorCode } from '../constants/errorCodes.js';

/**
 * 阿里云 OSS 配置校验
 * 
 * 参考文档：https://help.aliyun.com/zh/oss/user-guide/simple-upload
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
    region: OSS_REGION, // 按照文档建议，通常为 'oss-cn-hangzhou'
    bucket: OSS_BUCKET,
    accessKeyId: OSS_ACCESS_KEY_ID.trim(),
    accessKeySecret: OSS_ACCESS_KEY_SECRET.trim(),
    authorizationV4: true,
  };
};

/**
 * 获取 OSS 客户端实例
 */
const getClient = () => {
  const config = getOSSConfig();
  // console.log(config);
  return new OSS(config);
};

/**
 * 后端直接上传文件到 OSS
 * @param key 文件路径
 * @param file 本地文件路径或 Buffer
 */
export const uploadFile = async (key: string, file: string | Buffer) => {
  const client = getClient();
  const result = await client.put(key, file);
  return result;
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
