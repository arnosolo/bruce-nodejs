import { Runnable } from "@langchain/core/runnables";
import { createAgent } from "langchain";
import { AppError } from "../../utils/AppError.js";
import { ErrorCode } from "../../constants/errorCodes.js";
import { AgentInput, AgentOutput } from "./types.js";
import { getChatModel } from "./models.js";
import { updateUserProfile, searchFaq } from "./tools.js";

// 缓存 Agent 实例
let agentInstance: Runnable<AgentInput, AgentOutput> | null = null;

/**
 * 获取或初始化 Agent 实例 (单例模式 + 延迟加载)
 */
export async function getAgent(): Promise<Runnable<AgentInput, AgentOutput>> {
  if (agentInstance) {
    return agentInstance;
  }

  try {
    const model = await getChatModel();

    // 创建 Agent
    agentInstance = createAgent({
      model,
      tools: [updateUserProfile, searchFaq],
    }) as unknown as Runnable<AgentInput, AgentOutput>;

    return agentInstance;
  } catch (error) {
    console.error("Failed to initialize AI Agent:", error);
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCode.InternalError, "AI Service Initialization Failed");
  }
}
