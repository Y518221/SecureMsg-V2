import { Router } from "express";
import { messageController } from "../controllers/messageController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.post("/send", authenticate, messageController.send);
router.post("/bot-reply", authenticate, messageController.botReply);
router.get("/:otherId", authenticate, messageController.getDirectMessages);
router.delete("/:messageId", authenticate, messageController.delete);

export default router;
