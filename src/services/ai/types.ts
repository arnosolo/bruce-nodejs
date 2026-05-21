import { BaseMessage } from "@langchain/core/messages";

/**
 * 模型配置接口
 */
export interface ModelConfig {
  provider: string;
  modelName: string;
  temperature: number;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * 多模态内容结构
 */
export interface MultimodalContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string | null };
}

/**
 * 格式化后的消息结构，兼容多模态
 */
export interface FormattedMessage {
  role: "user" | "assistant" | "system";
  content: string | MultimodalContent[];
}

// 定义 Agent 的输入输出结构
export interface AgentInput {
  messages: Array<FormattedMessage | BaseMessage>;
}

export interface AgentOutput {
  messages: BaseMessage[];
}
