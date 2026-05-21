import { Router } from "express";
import * as faqController from "../controllers/faq.controller.js";
import { authenticate } from "../middlewares/auth.js";

const router = Router();

// FAQ 搜索接口（公开或认证均可，这里设为公开搜索，管理需认证）
router.get("/search", faqController.searchFAQs);

// 管理接口
router.get("/", authenticate, faqController.getAllFAQs);
router.post("/", authenticate, faqController.createFAQ);
router.put("/:id", authenticate, faqController.updateFAQ);
router.delete("/:id", authenticate, faqController.deleteFAQ);

export default router;
