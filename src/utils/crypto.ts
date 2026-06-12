/**
 * 生成指定位数的数字验证码
 * @param length 验证码长度，默认为 6
 * @returns 验证码字符串
 */
export const generateNumericCode = (length: number = 6): string => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
};
