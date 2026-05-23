import { Runnable } from "@langchain/core/runnables";
import { initChatModel } from "langchain";
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { AppError } from "../../utils/AppError.js";
import { ErrorCode } from "../../constants/errorCodes.js";
import { ModelConfig } from "./types.js";
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

// 缓存 Model 实例
let modelInstance: Runnable | null = null;
// 缓存 Embeddings 实例
let embeddingsInstance: GoogleGenAI | GoogleGenerativeAIEmbeddings | OllamaEmbeddings | null = null;

/**
 * 获取或初始化 Embeddings 实例 (单例模式)
 */
export async function getEmbeddingsModel(): Promise<GoogleGenAI | GoogleGenerativeAIEmbeddings | OllamaEmbeddings> {
  if (embeddingsInstance) {
    return embeddingsInstance;
  }

  const provider = process.env.AI_PROVIDER;
  const apiKey = process.env.AI_API_KEY || process.env.GOOGLE_API_KEY;

  if (provider === "google-genai") {
    if (!apiKey) {
      throw new AppError(ErrorCode.ConfigError, "Missing API Key for Google Embeddings");
    }
    // 示例中的 embedding-001 模型返回 404, 
    // gemini-embedding-001 模型可以用, 但是输出的向量是 3072 维
    // embeddingsInstance = new GoogleGenerativeAIEmbeddings({
    //   apiKey: apiKey,
    //   modelName: "gemini-embedding-001",
    // });
    // 换成 Google 原生 SDK 来生成向量
    const ai = new GoogleGenAI({ apiKey });
    embeddingsInstance = ai
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
 * 初始化 Google Gemini 模型
 */
const initGoogleModel = async (config: ModelConfig) => {
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
  return model;
};

/**
 * 获取或初始化 Chat Model 实例 (单例模式)
 */
export async function getChatModel(): Promise<Runnable> {
  if (modelInstance) {
    return modelInstance;
  }

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
