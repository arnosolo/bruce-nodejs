import { prisma } from "../lib/prisma.js";

export interface UpdateProfileInput {
  name?: string;
  avatarKey?: string;
}

/**
 * 更新用户个人资料
 * @param userId 用户 ID
 * @param data 更新数据
 * @returns 更新后的用户对象
 */
export const updateProfile = async (userId: number, data: UpdateProfileInput) => {
  return await prisma.user.update({
    where: { id: userId },
    data,
  });
};
