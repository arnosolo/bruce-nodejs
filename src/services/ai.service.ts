import { tool } from "@langchain/core/tools";
import "dotenv/config";
import { initChatModel, createAgent } from "langchain";
import { BaseMessage } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import z from "zod";
import { prisma } from "../lib/prisma.js";
import { MessageRole } from "../../generated/prisma/client.js";
import { AppError } from "../utils/AppError.js";
import { ErrorCode } from "../constants/errorCodes.js";

// 定义 Agent 的输入输出结构
interface AgentInput {
  messages: Array<{ role: string; content: string } | BaseMessage>;
}

interface AgentOutput {
  messages: BaseMessage[];
}

// 缓存 Agent 实例，使用 Runnable 接口进行约束
let agentInstance: Runnable<AgentInput, AgentOutput> | null = null;

/**
 * 获取或初始化 Agent 实例 (单例模式 + 延迟加载)
 */
async function getAgent(): Promise<Runnable<AgentInput, AgentOutput>> {
  if (agentInstance) {
    return agentInstance;
  }

  // 校验环境变量
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new AppError(ErrorCode.ConfigError, "Missing GOOGLE_API_KEY");
  }

  try {
    // 初始化 Gemini 模型
    const model = await initChatModel("google-genai:gemini-2.5-flash-lite", {
      temperature: 0.7,
      apiKey: apiKey, // 显式传递 API Key
    });

    // 定义工具
    // const getWeather = tool(
    //   (input) => `It's sunny in ${input.location}.`,
    //   {
    //     name: "get_weather",
    //     description: "Get the weather at a location.",
    //     schema: z.object({
    //       location: z.string()
    //     })
    //   }
    // );

    // 创建 Agent
    agentInstance = createAgent({
      model,
      // tools: [getWeather],
    }) as unknown as Runnable<AgentInput, AgentOutput>;

    return agentInstance;
  } catch (error) {
    console.error("Failed to initialize Gemini Agent:", error);
    throw new AppError(ErrorCode.InternalError, "AI Service Initialization Failed");
  }
}

/**
 * 生成 AI 回复 (使用 Gemini Agent)
 * @param content 用户输入的内容
 * @param conversationId 会话 ID
 * @returns AI 生成的文本
 */
export const generateAgentResponse = async (content: string, conversationId: number): Promise<string> => {
  // 确保 Agent 已初始化 (包含环境变量校验)
  const agent = await getAgent();

  try {
    // 1. 获取最近的聊天历史
    const historyMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // 转换为符合接口的消息格式
    const formattedHistory = historyMessages
      .reverse()
      .map((msg) => ({
        role: msg.role === MessageRole.USER ? "user" : "assistant",
        content: msg.content,
      }));

    // 2. 调用 Agent
    const result = await agent.invoke({
      messages: [
        ...formattedHistory,
        // { role: "user", content: content }
      ],
    });

    // console.log(result.messages.map(it => it.content));
    
    // 3. 获取最后一条 AI 消息的内容
    const lastMessage = result.messages[result.messages.length - 1];
    
    // 确保 content 是字符串
    const responseContent = lastMessage.content;
    return typeof responseContent === "string" ? responseContent : JSON.stringify(responseContent);
  } catch (error) {
    console.error("Gemini Agent Error:", error);
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCode.InternalError, "AI Agent failed to generate response");
  }
};
