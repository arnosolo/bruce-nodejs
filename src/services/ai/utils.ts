import { Message, MessageRole, MessageType } from "../../../generated/prisma/index.js";
import { FormattedMessage, MultimodalContent } from "./types.js";
import * as ossService from "../oss.service.js";

/**
 * 格式化消息历史，支持多模态（图片）
 */
export const formatMessageHistory = async (messages: Message[]): Promise<FormattedMessage[]> => {
  return Promise.all(
    messages.reverse().map(async (msg) => {
      const role = msg.role === MessageRole.USER ? "user" : "assistant";

      if (msg.type === MessageType.IMAGE && msg.attachmentKey) {
        const imageData = await ossService.getFileBase64(msg.attachmentKey);
        const content: MultimodalContent[] = [
          {
            type: "image_url",
            image_url: { url: imageData },
          },
        ];
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
