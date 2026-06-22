import { prisma } from "../lib/prisma.js";
import * as aiService from "./ai.service.js";
import { AppError } from "../utils/AppError.js";
import { ErrorCode } from "../constants/errorCodes.js";

/**
 * 创建 FAQ 并生成向量
 */
export const createFAQ = async (question: string, answer: string) => {
  const embedding = await aiService.generateEmbedding(question);
  const modelName = aiService.getEmbeddingModelName();
  
  // 使用 raw query 插入向量，因为 Prisma 不直接支持 vector 类型赋值
  const vectorString = `[${embedding.join(",")}]`;
  
  const result = await prisma.$executeRaw`
    INSERT INTO "Faq" (question, answer, embedding, "embeddingModel", "updatedAt")
    VALUES (${question}, ${answer}, ${vectorString}::vector, ${modelName || null}, NOW())
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
    const modelName = aiService.getEmbeddingModelName();
    const vectorString = `[${embedding.join(",")}]`;
    
    await prisma.$executeRaw`
      UPDATE "Faq"
      SET question = ${data.question}, 
          answer = ${data.answer || faq.answer}, 
          embedding = ${vectorString}::vector,
          "embeddingModel" = ${modelName || null},
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
export const searchFAQs = async (
  query: string,
  limit: number = 5,
  minSimilarity: number = 0.7,
) => {
  const embedding = await aiService.generateEmbedding(query);
  const vectorString = `[${embedding.join(",")}]`;

  // 使用 pgvector 的 <-> (L2 距离) 或 <=> (余弦相似度) 进行搜索
  // 这里使用 <=> 余弦距离 (1 - cosine similarity)
  const faqs = await prisma.$queryRaw<any[]>`
    SELECT id, "question", "answer", 1 - (embedding <=> ${vectorString}::vector) as similarity, "embeddingModel"
    FROM "Faq"
    -- 相似度大于等于阈值才返回
    WHERE 1 - (embedding <=> ${vectorString}::vector) >= ${minSimilarity}
    ORDER BY embedding <=> ${vectorString}::vector
    LIMIT ${limit}
  `;

  return faqs;
};

/**
 * 重新生成所有 FAQ 的向量
 * @param force 是否强制重刷所有向量。如果为 false，则仅刷新模型不匹配或缺失向量的数据。
 */
export const rebuildAllEmbeddings = async (force: boolean = false) => {
  const currentModel = aiService.getEmbeddingModelName();
  if (!currentModel) {
    throw new AppError(ErrorCode.ConfigError, "AI_EMBEDDING_MODEL is not configured for re-indexing");
  }
  
  // 1. 获取需要刷新的数据
  const faqs = await prisma.faq.findMany({
    where: force ? {} : {
      OR: [
        { embeddingModel: { not: currentModel } },
        { embeddingModel: null }
      ]
    },
    select: { id: true, question: true }
  });

  console.log(`Starting re-vectorization for ${faqs.length} FAQs...`);

  let successCount = 0;
  let failureCount = 0;

  // 2. 遍历并刷新（生产环境建议使用队列或控制并发）
  for (const faq of faqs) {
    try {
      const embedding = await aiService.generateEmbedding(faq.question);
      const vectorString = `[${embedding.join(",")}]`;
      
      await prisma.$executeRaw`
        UPDATE "Faq"
        SET embedding = ${vectorString}::vector,
            "embeddingModel" = ${currentModel},
            "updatedAt" = NOW()
        WHERE id = ${faq.id}
      `;
      successCount++;
    } catch (error) {
      console.error(`Failed to re-index FAQ ${faq.id}:`, error);
      failureCount++;
    }
  }

  console.log(`Re-vectorization completed. Success: ${successCount}, Failure: ${failureCount}, Model: ${currentModel}`);

  return {
    total: faqs.length,
    success: successCount,
    failure: failureCount,
    model: currentModel
  };
};
