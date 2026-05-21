import { prisma } from "../lib/prisma.js";
import * as aiService from "./ai.service.js";
import { AppError } from "../utils/AppError.js";
import { ErrorCode } from "../constants/errorCodes.js";

/**
 * 创建 FAQ 并生成向量
 */
export const createFAQ = async (question: string, answer: string) => {
  const embedding = await aiService.generateEmbedding(question);
  
  // 使用 raw query 插入向量，因为 Prisma 不直接支持 vector 类型赋值
  const vectorString = `[${embedding.join(",")}]`;
  
  const result = await prisma.$executeRaw`
    INSERT INTO "Faq" (question, answer, embedding, "updatedAt")
    VALUES (${question}, ${answer}, ${vectorString}::vector, NOW())
  `;
  
  return result;
};

/**
 * 获取分页的 FAQ 列表
 */
export const getFAQs = async (page: number = 1, limit: number = 20, keyword?: string) => {
  const skip = (page - 1) * limit;
  
  const where = keyword ? {
    OR: [
      { question: { contains: keyword, mode: "insensitive" as const } },
      { answer: { contains: keyword, mode: "insensitive" as const } }
    ]
  } : {};

  const [list, total] = await Promise.all([
    prisma.faq.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.faq.count({ where }),
  ]);

  return {
    list,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * 更新 FAQ
 */
export const updateFAQ = async (id: number, data: { question?: string; answer?: string }) => {
  const faq = await prisma.faq.findUnique({ where: { id } });
  if (!faq) throw new AppError(ErrorCode.NotFound, "FAQ not found");

  if (data.question) {
    const embedding = await aiService.generateEmbedding(data.question);
    const vectorString = `[${embedding.join(",")}]`;
    
    await prisma.$executeRaw`
      UPDATE "Faq"
      SET question = ${data.question}, 
          answer = ${data.answer || faq.answer}, 
          embedding = ${vectorString}::vector,
          "updatedAt" = NOW()
      WHERE id = ${id}
    `;
  } else if (data.answer) {
    await prisma.faq.update({
      where: { id },
      data: { answer: data.answer },
    });
  }
};

/**
 * 删除 FAQ
 */
export const deleteFAQ = async (id: number) => {
  return prisma.faq.delete({ where: { id } });
};

/**
 * 向量搜索最相关的 FAQ
 */
export const searchFAQs = async (query: string, limit: number = 5) => {
  const embedding = await aiService.generateEmbedding(query);
  const vectorString = `[${embedding.join(",")}]`;

  // 使用 pgvector 的 <-> (L2 距离) 或 <=> (余弦相似度) 进行搜索
  // 这里使用 <=> 余弦距离 (1 - cosine similarity)
  const faqs = await prisma.$queryRaw<any[]>`
    SELECT id, "question", "answer", 1 - (embedding <=> ${vectorString}::vector) as similarity
    FROM "Faq"
    ORDER BY embedding <=> ${vectorString}::vector
    LIMIT ${limit}
  `;

  return faqs;
};
