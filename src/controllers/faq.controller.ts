import { Request, Response, NextFunction } from "express";
import * as faqService from "../services/faq.service.js";
import { AppError } from "../utils/AppError.js";
import { ErrorCode } from "../constants/errorCodes.js";

/**
 * 获取分页 FAQ 列表
 */
export const getAllFAQs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const keyword = req.query.keyword as string | undefined;

    const result = await faqService.getFAQs(page, limit, keyword);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 创建 FAQ
 */
export const createFAQ = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question, answer } = req.body;
    if (!question || !answer) {
      throw new AppError(ErrorCode.InvalidRequest, "Question and answer are required");
    }

    await faqService.createFAQ(question, answer);
    res.status(201).json({
      success: true,
      message: "FAQ created successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 更新 FAQ
 */
export const updateFAQ = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id as string);
    const { question, answer } = req.body;
    
    if (isNaN(id)) {
      throw new AppError(ErrorCode.InvalidRequest, "Invalid FAQ ID");
    }

    await faqService.updateFAQ(id, { question, answer });
    res.json({
      success: true,
      message: "FAQ updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 删除 FAQ
 */
export const deleteFAQ = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      throw new AppError(ErrorCode.InvalidRequest, "Invalid FAQ ID");
    }

    await faqService.deleteFAQ(id);
    res.json({
      success: true,
      message: "FAQ deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 搜索 FAQ
 */
export const searchFAQs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, limit } = req.query;
    if (!q || typeof q !== "string") {
      throw new AppError(ErrorCode.InvalidRequest, "Search query is required");
    }

    const searchLimit = limit ? parseInt(limit as string) : 5;
    const results = await faqService.searchFAQs(q, searchLimit);
    
    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};
