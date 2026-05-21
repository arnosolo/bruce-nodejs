import { tool } from "@langchain/core/tools";
import "dotenv/config";
import { initChatModel, createAgent } from "langchain";
import { BaseMessage } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import z from "zod";
import { prisma } from "../lib/prisma.js";
import { Message, MessageRole, MessageType } from "../../generated/prisma/index.js";
import { AppError } from "../utils/AppError.js";
import { ErrorCode } from "../constants/errorCodes.js";
import * as userService from "./user.service.js";
import * as ossService from "./oss.service.js";
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

/**
 * 系统的核心指令，定义 AI 的身份、语气和行为规范
 */
const SYSTEM_PROMPT = `你是一位专业、友善且高效的 AI 客服助手。
你的目标是为用户提供准确的帮助。

行为准则：
1. 身份认同：你是该平台的官方 AI 客服，始终保持礼貌 and 专业的态度。
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

/**
 * 多模态内容结构
 */
interface MultimodalContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string | null };
}

/**
 * 格式化后的消息结构，兼容多模态
 */
interface FormattedMessage {
  role: "user" | "assistant" | "system";
  content: string | MultimodalContent[];
}

// 定义 Agent 的输入输出结构
interface AgentInput {
  messages: Array<FormattedMessage | BaseMessage>;
}

interface AgentOutput {
  messages: BaseMessage[];
}

// 缓存 Model 实例
let modelInstance: Runnable | null = null;
// 缓存 Embeddings 实例
let embeddingsInstance: GoogleGenerativeAIEmbeddings | OllamaEmbeddings | null = null;
// 缓存 Agent 实例，使用 Runnable 接口进行约束
let agentInstance: Runnable<AgentInput, AgentOutput> | null = null;

/**
 * 获取或初始化 Embeddings 实例 (单例模式)
 */
export async function getEmbeddingsModel(): Promise<GoogleGenerativeAIEmbeddings | OllamaEmbeddings> {
  if (embeddingsInstance) {
    return embeddingsInstance;
  }

  const provider = process.env.AI_PROVIDER;
  const apiKey = process.env.AI_API_KEY || process.env.GOOGLE_API_KEY;

  if (provider === "google-genai") {
    if (!apiKey) {
      throw new AppError(ErrorCode.ConfigError, "Missing API Key for Google Embeddings");
    }
    embeddingsInstance = new GoogleGenerativeAIEmbeddings({
      apiKey: apiKey,
      modelName: "text-embedding-004", // 默认使用 768 维的模型 (如 text-embedding-004)
    });
  } else if (provider === "ollama") {
    embeddingsInstance = new OllamaEmbeddings({
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      model: process.env.AI_EMBEDDING_MODEL || "nomic-embed-text",
    });
  } else {
    throw new AppError(ErrorCode.ConfigError, `Unsupported AI provider for embeddings: "${provider}"`);
  }

  return embeddingsInstance;
}

/**
 * 生成文本的向量表示
 * @param text 文本内容
 * @returns 向量数组
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    const model = await getEmbeddingsModel();
    return await model.embedQuery(text);
  } catch (error) {
    console.error("Failed to generate embedding:", error);
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCode.InternalError, "AI Service failed to generate embedding");
  }
};

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
 * 格式化消息历史，支持多模态（图片）
 */
const formatMessageHistory = async (messages: Message[]): Promise<FormattedMessage[]> => {
  return Promise.all(
    messages.reverse().map(async (msg) => {
      const role = msg.role === MessageRole.USER ? "user" : "assistant";

      if (msg.type === MessageType.IMAGE && msg.attachmentKey) {
        // Gemini 等模型通常需要 base64 格式的图片数据
        const imageData = await ossService.getFileBase64(msg.attachmentKey);
        const content: MultimodalContent[] = [
          {
            type: "image_url",
            image_url: { url: imageData },
          },
        ];
        // 只有当 content 不为空时才添加文本部分
        if (msg.content && msg.content.trim()) {
          content.unshift({ type: "text", text: msg.content });
        }
        return {
          role,
          content,
        };
      }

      return {
        role,
        content: msg.content,
      };
    })
  );
};

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
    const formattedHistory = await formatMessageHistory(historyMessages);
    // console.log(formattedHistory);

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

    // 3. 获取最后一条 AI 消息的内容
    const lastMessage = result.messages[result.messages.length - 1];
    
    // 确保 content 是字符串
    const responseContent = lastMessage.content;
    // console.log('AI response', responseContent);
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
    // 1. 获取最近的聊天历史
    const historyMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const formattedHistory = await formatMessageHistory(historyMessages);

    // 2. 调用 Agent 的 stream 方法
    const stream = await agent.stream({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...formattedHistory,
      ],
    }, {
      configurable: { userId }
    });

    for await (const chunk of stream) {
      // console.log(chunk);
      
      // 遍历 chunk 中的所有节点输出 (如 model_request, tools 等)
      const chunkData = chunk as Record<string, any>;
      for (const key of Object.keys(chunkData)) {
        const nodeOutput = chunkData[key];

        // 检查节点输出是否有 messages 数组
        if (nodeOutput && Array.isArray(nodeOutput.messages)) {
          const lastMsg = nodeOutput.messages[nodeOutput.messages.length - 1] as BaseMessage;

          // 过滤逻辑：
          // 1. 必须是 AI 消息 (排除 ToolMessage)
          // 2. content 必须是字符串 (排除包含 tool_calls 的数组结构)
          // 3. 避免空内容
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
    // 1. 获取会话的前几条消息作为背景
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 5, // 只取前 5 条消息生成标题即可
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

    // 2. 构造 Prompt 要求模型生成标题
    const prompt = `请根据以下对话内容，生成一个简短、准确的会话标题（不超过 15 个字）。
      直接返回标题文字，不要包含引号或其他修饰。对话内容：${contentSummary}`;
    // console.log(`[summarize] prompt = ${prompt}`);
      
    const result = await model.invoke(prompt);
    // console.log(`[summarize] result`, result);
    
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
