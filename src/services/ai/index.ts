import { prisma } from "../../lib/prisma.js";
import { MessageRole, MessageType } from "../../../generated/prisma/index.js";
import { AppError } from "../../utils/AppError.js";
import { ErrorCode } from "../../constants/errorCodes.js";
import { getChatModel, getEmbeddingsModel } from "./models.js";
import { getAgent } from "./agent.js";
import { formatMessageHistory } from "./utils.js";
import { SYSTEM_PROMPT } from "./prompts.js";
import { BaseMessage } from "@langchain/core/messages";
import { GoogleGenAI } from "@google/genai";

// 重新导出底层方法，以便外部直接使用 (如 generateEmbedding)
export { getChatModel, getEmbeddingsModel } from "./models.js";

/**
 * 生成文本的向量表示
 * @param text 文本内容
 * @returns 向量数组
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    const model = await getEmbeddingsModel();
    if (model instanceof GoogleGenAI) {
      const response = await model.models.embedContent({
        model: "gemini-embedding-001",
        contents: text,
        config: {
          outputDimensionality: 768 // 在这里指定维度
        }
      });
      
      // ✅ 修复：正确获取 Gemini 嵌入向量
      const embeddingValues = response.embeddings?.[0]?.values;
      if (!embeddingValues || embeddingValues.length === 0) {
        throw new Error("Gemini returned empty embedding");
      }
      // console.log(embeddingValues);
      
      return embeddingValues;
    }
    return await model.embedQuery(text);
  } catch (error) {
    console.error("Failed to generate embedding:", error);
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCode.InternalError, "AI Service failed to generate embedding");
  }
};

/**
 * 生成 AI 回复 (使用 Gemini Agent)
 * @param conversationId 会话 ID
 * @param userId 用户 ID
 * @returns AI 生成的文本
 */
export const generateAgentResponse = async (conversationId: number, userId: number): Promise<string> => {
  const agent = await getAgent();

  try {
    const historyMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const formattedHistory = await formatMessageHistory(historyMessages);

    const result = await agent.invoke({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...formattedHistory,
      ],
    }, {
      configurable: { userId }
    });

    const lastMessage = result.messages[result.messages.length - 1];
    const responseContent = lastMessage.content;
    return typeof responseContent === "string" ? responseContent : JSON.stringify(responseContent);
  } catch (error) {
    console.error("Gemini Agent Error:", error);
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCode.InternalError, "AI Agent failed to generate response");
  }
};

/**
 * 流式生成 AI 回复
 * @param conversationId 会话 ID
 * @param userId 用户 ID
 * @returns 异步生成器，产出文本分片
 */
export async function* streamAgentResponse(conversationId: number, userId: number): AsyncGenerator<string> {
  const agent = await getAgent();

  try {
    const historyMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const formattedHistory = await formatMessageHistory(historyMessages);

    const stream = await agent.stream({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...formattedHistory,
      ],
    }, {
      configurable: { userId }
    });

    for await (const chunk of stream) {
      const chunkData = chunk as Record<string, any>;
      for (const key of Object.keys(chunkData)) {
        const nodeOutput = chunkData[key];

        if (nodeOutput && Array.isArray(nodeOutput.messages)) {
          const lastMsg = nodeOutput.messages[nodeOutput.messages.length - 1] as BaseMessage;

          if (
            (lastMsg._getType?.() === "ai" || (lastMsg as any).role === "assistant") &&
            typeof lastMsg.content === "string" &&
            lastMsg.content.trim().length > 0
          ) {
            yield lastMsg.content;
          }
        }
      }
    }
  } catch (error) {
    console.error("AI Streaming Error:", error);
    throw new AppError(ErrorCode.InternalError, "AI Service Streaming Failed");
  }
}

/**
 * 根据会话历史生成一个简洁的标题
 * @param conversationId 会话 ID
 * @returns 生成的标题
 */
export const summarizeConversationTitle = async (conversationId: number): Promise<string> => {
  const model = await getChatModel();

  try {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 5,
    });

    if (messages.length === 0) {
      throw new AppError(ErrorCode.InvalidRequest, "No messages found in this conversation to summarize.");
    }

    const contentSummary = messages
      .map((m) => {
        const roleName = m.role === MessageRole.USER ? "User" : "AI";
        const textContent = m.type === MessageType.IMAGE ? `[图片] ${m.content || ""}` : m.content;
        return `${roleName}: ${textContent}`;
      })
      .join("\n");

    const prompt = `请根据以下对话内容，生成一个简短、准确的会话标题（不超过 15 个字）。
      直接返回标题文字，不要包含引号或其他修饰。对话内容：${contentSummary}`;
      
    const result = await model.invoke(prompt);
    
    let title = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    
    title = title.replace(/["'“”]/g, "").trim();
    if (title.startsWith("标题：")) title = title.substring(3);
    if (title.length > 30) title = title.substring(0, 27) + "...";

    if (!title) {
      throw new AppError(ErrorCode.InternalError, "AI failed to generate a valid title.");
    }

    return title;
  } catch (error) {
    console.error("Failed to summarize conversation title:", error);
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCode.InternalError, "AI Service failed during title summarization");
  }
};
