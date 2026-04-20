import { Router } from "express";
import { groupController } from "../controllers/groupController.js";
import { messageController } from "../controllers/messageController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.post("/create", authenticate, groupController.create);
router.post("/join/:groupId", authenticate, groupController.join);
router.get("/", authenticate, groupController.list);
router.get("/:groupId/messages", authenticate, messageController.getGroupMessages);
router.delete("/:groupId", authenticate, groupController.delete);

export default router;
