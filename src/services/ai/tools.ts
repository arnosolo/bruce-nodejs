import { tool } from "@langchain/core/tools";
import z from "zod";
import * as userService from "../user.service.js";
import * as faqService from "../faq.service.js";

/**
 * 更新用户信息的工具
 */
export const updateUserProfile = tool(
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

/**
 * 搜索 FAQ 知识库的工具
 */
export const searchFaq = tool(
  async ({ query }) => {
    try {
      const results = await faqService.searchFAQs(query, 3);
      if (results.length === 0) {
        return "No matching FAQ found. You may need to answer based on your general knowledge or ask the user for more details.";
      }
      const formattedResults = results
        .map((f, i) => `Result ${i + 1}:\nQuestion: ${f.question}\nAnswer: ${f.answer}`)
        .join("\n\n");
      return `Found relevant FAQ information:\n\n${formattedResults}`;
    } catch (error) {
      console.error("Failed to search FAQ:", error);
      return "Error occurred while searching for FAQ information.";
    }
  },
  {
    name: "search_faq",
    description: "Search for answers in the official FAQ database. Use this when users ask about company policies, product features, how-to guides, or common questions.",
    schema: z.object({
      query: z.string().describe("The search query for FAQ"),
    }),
  }
);
