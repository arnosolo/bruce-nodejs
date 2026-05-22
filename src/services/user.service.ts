import { prisma } from "../lib/prisma.js";
import { Role } from "../../generated/prisma/index.js";

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

/**
 * 获取用户列表 (仅管理员可用)
 * @param params 分页和过滤参数
 * @returns 用户列表和总数
 */
export const getUsers = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
}) => {
  const { page = 1, limit = 10, search, role } = params;
  const skip = (page - 1) * limit;

  const where: any = {
    deletedAt: null,
  };

  if (role) {
    where.role = role;
  }

  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    list: users,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * 更新用户角色 (仅管理员可用)
 * @param userId 目标用户 ID
 * @param role 新角色
 * @returns 更新后的用户对象
 */
export const updateUserRole = async (userId: number, role: Role) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { role },
  });
};
