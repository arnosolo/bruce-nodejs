/**
 * 将字符串映射为特定的枚举值
 * @param value - 待转换的字符串
 * @param enumObj - 枚举对象 (例如 Role)
 * @returns 匹配的枚举值，若未匹配则返回 undefined
 * @example
 * enum Role {
 * Admin = "ADMIN",
 * User = "USER"
 * }
 * const myRole = mapToEnum("ADMIN", Role);   // 返回 Role.Admin ("ADMIN")
 * const fakeRole = mapToEnum("HACKER", Role); // 返回 undefined
 */
export function mapToEnum<T extends Record<string, string | number>>(
  value: unknown,
  enumObj: T
): T[keyof T] | undefined {
  // 基础类型过滤: 枚举值只可能是 string 或 number
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  // 获取枚举对象中所有的值
  const enumValues = Object.values(enumObj);

  // 检查输入的值是否存在于枚举中
  if (enumValues.includes(value)) {
    return value as T[keyof T];
  }

  return undefined;
}
