import { Router } from "express";
import * as faqController from "../controllers/faq.controller.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import { Role } from "../../generated/prisma/index.js";

const router = Router();

// FAQ 搜索接口（公开或认证均可，这里设为公开搜索，管理需认证）
router.get("/search", faqController.searchFAQs);

// 管理接口
router.get("/", authenticate, authorize(Role.ADMIN, Role.AGENT), faqController.getAllFAQs);
router.post("/", authenticate, authorize(Role.ADMIN, Role.AGENT), faqController.createFAQ);
router.put("/:id", authenticate, authorize(Role.ADMIN, Role.AGENT), faqController.updateFAQ);
router.delete("/:id", authenticate, authorize(Role.ADMIN, Role.AGENT), faqController.deleteFAQ);

// 重新向量化（仅限管理员）
router.post("/rebuild", authenticate, authorize(Role.ADMIN), faqController.rebuildEmbeddings);

export default router;
