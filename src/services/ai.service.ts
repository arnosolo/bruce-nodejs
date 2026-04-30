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
import * as userService from "./user.service.js";
import { ChatOllama } from "@langchain/ollama";

/**
 * 系统的核心指令，定义 AI 的身份、语气和行为规范
 */
const SYSTEM_PROMPT = `你是一位专业、友善且高效的 AI 客服助手。
你的目标是为用户提供准确的帮助。

行为准则：
1. 身份认同：你是该平台的官方 AI 客服，始终保持礼貌和专业的态度。
2. 工具使用：如果用户提到自己的名字（如“我叫小明”）或要求更改姓名，请务必使用 'update_user_profile' 工具进行更新。
3. 简洁性：回复应直接、清晰，避免冗长的废话。
4. 边界意识：仅回答与客服、平台使用及用户账户相关的问题。`;

/**
 * 模型配置接口
 */
interface ModelConfig {
  provider: string;
  modelName: string;
  temperature: number;
  apiKey?: string;
  baseUrl?: string;
}

// 定义 Agent 的输入输出结构
interface AgentInput {
  messages: Array<{ role: string; content: string } | BaseMessage>;
}

interface AgentOutput {
  messages: BaseMessage[];
}

// 缓存 Model 实例
let modelInstance: Runnable | null = null;
// 缓存 Agent 实例，使用 Runnable 接口进行约束
let agentInstance: Runnable<AgentInput, AgentOutput> | null = null;

/**
 * 初始化 Google Gemini 模型
 */
const initGoogleModel = async (config: ModelConfig) => {
  // 优先级: 显性传入的 config.apiKey (来自 AI_API_KEY) > 环境变量 GOOGLE_API_KEY
  const apiKey = config.apiKey || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new AppError(ErrorCode.ConfigError, "Missing API Key: Please set AI_API_KEY or GOOGLE_API_KEY");
  }
  return initChatModel(`${config.provider}:${config.modelName}`, { temperature: config.temperature, apiKey });
};

/**
 * 初始化 OpenAI 模型
 */
const initOpenAIModel = async (config: ModelConfig) => {
  // 优先级: 显性传入的 config.apiKey (来自 AI_API_KEY) > 环境变量 OPENAI_API_KEY
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AppError(ErrorCode.ConfigError, "Missing API Key: Please set AI_API_KEY or OPENAI_API_KEY");
  }
  return initChatModel(`${config.provider}:${config.modelName}`, { temperature: config.temperature, apiKey });
};

/**
 * 初始化 Ollama 模型
 */
const initOllamaModel = async (config: ModelConfig) => {
  const baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const modelName = config.modelName;
  if (!modelName) throw new AppError(ErrorCode.ConfigError, "Missing AI_MODEL_NAME");

  const model = new ChatOllama({
    baseUrl: baseUrl,
    model: modelName,
    temperature: config.temperature,
  });
  return model
};

/**
 * 获取或初始化 Chat Model 实例 (单例模式)
 */
export async function getChatModel(): Promise<Runnable> {
  if (modelInstance) {
    return modelInstance;
  }

  // 从环境变量获取配置
  const provider = process.env.AI_PROVIDER;
  const modelName = process.env.AI_MODEL_NAME;
  const temperature = parseFloat(process.env.AI_TEMPERATURE || "0.7");

  if (!provider || !modelName) {
    throw new AppError(
      ErrorCode.ConfigError,
      "Missing AI configuration: AI_PROVIDER and AI_MODEL_NAME must be defined in environment variables."
    );
  }

  const config: ModelConfig = {
    provider,
    modelName,
    temperature,
    // AI_API_KEY 作为通用 Key (如使用 One API/中转代理) 具有最高优先级
    apiKey: process.env.AI_API_KEY,
  };

  try {
    switch (provider) {
      case "google-genai":
        modelInstance = await initGoogleModel(config);
        break;
      case "openai":
        modelInstance = await initOpenAIModel(config);
        break;
      case "ollama":
        modelInstance = await initOllamaModel(config);
        break;
      default:
        throw new AppError(
          ErrorCode.ConfigError,
          `Unsupported AI provider: "${provider}".`
        );
    }
    return modelInstance;
  } catch (error) {
    console.error(`Failed to initialize AI Model (${modelName}):`, error);
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCode.InternalError, "AI Model Initialization Failed");
  }
}

/**
 * 获取或初始化 Agent 实例 (单例模式 + 延迟加载)
 */
async function getAgent(): Promise<Runnable<AgentInput, AgentOutput>> {
  if (agentInstance) {
    return agentInstance;
  }

  try {
    // 获取单例模型
    const model = await getChatModel();

    // 定义工具
    const updateUserProfile = tool(
      async (input, { configurable }) => {
        const userId = configurable?.userId;
        if (!userId) {
          return "Error: User ID not provided. Cannot update profile.";
        }
        try {
          await userService.updateProfile(userId, { name: input.name });
          return `Successfully updated your profile. Name is now ${input.name}.`;
        } catch (error) {
          console.error("Failed to update user profile:", error);
          return "Failed to update your profile due to a database error.";
        }
      },
      {
        name: "update_user_profile",
        description: "Update the user's profile information. Currently supports updating the name. Use this when the user wants to change their name or introduces themselves.",
        schema: z.object({
          name: z.string().optional().describe("The new name of the user"),
        }),
      }
    );

    // 创建 Agent
    agentInstance = createAgent({
      model,
      tools: [updateUserProfile],
    }) as unknown as Runnable<AgentInput, AgentOutput>;

    return agentInstance;
  } catch (error) {
    console.error("Failed to initialize AI Agent:", error);
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCode.InternalError, "AI Service Initialization Failed");
  }
}

/**
 * 生成 AI 回复 (使用 Gemini Agent)
 * @param conversationId 会话 ID
 * @param userId 用户 ID
 * @returns AI 生成的文本
 */
export const generateAgentResponse = async (conversationId: number, userId: number): Promise<string> => {
  // 确保 Agent 已初始化 (包含环境变量校验)
  const agent = await getAgent();

  try {
    // 1. 获取最近的聊天历史 (包含刚刚已保存到数据库的用户最新消息)
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
        { role: "system", content: SYSTEM_PROMPT },
        ...formattedHistory,
      ],
    }, {
      // 通过 configurable 传递上下文，使 Tool 能够获取当前用户 ID
      configurable: { userId }
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
