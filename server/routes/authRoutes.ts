import { Router } from "express";
import { authController } from "../controllers/authController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", authenticate, authController.getMe);
router.get("/search/:secureId", authenticate, authController.search);
router.delete("/me", authenticate, authController.deleteMe);
router.get("/conversations", authenticate, authController.getConversations);

export default router;
