import { messageService } from "../services/messageService.js";
import { botService } from "../services/botService.js";

export const messageController = {
  async send(req: any, res: any) {
    try {
      const message = await messageService.send(req.userId, req.body);
      res.json({
        success: true,
        id: message.id,
        created_at: message.created_at,
        sender_id: message.sender_id,
        receiver_id: message.receiver_id,
        group_id: message.group_id,
        type: message.type,
      });
    } catch (e: any) {
      console.error("Message send error:", e);
      res.status(e.status || 500).json({ error: e.message || "Failed to send message" });
    }
  },

  async getDirectMessages(req: any, res: any) {
    try {
      const messages = await messageService.getDirectMessages(req.userId, req.params.otherId);
      res.json(messages);
    } catch (e: any) {
      console.error("Fetch messages error:", e);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  },

  async getGroupMessages(req: any, res: any) {
    try {
      const messages = await messageService.getGroupMessagesForUser(req.userId, req.params.groupId);
      res.json(messages);
    } catch (e: any) {
      res.status(e.status || 500).json({ error: e.message || "Failed to fetch group messages" });
    }
  },

  async delete(req: any, res: any) {
    try {
      await messageService.delete(req.userId, req.params.messageId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(e.status || 500).json({ error: e.message || "Failed to delete message" });
    }
  },

  async botReply(req: any, res: any) {
    try {
      if (req.body?.contentEncrypted && req.body?.iv && req.body?.salt) {
        // This is a save request - no need to generate reply again
        const botMessage = await messageService.saveBotReply(req.userId, {
          contentEncrypted: req.body.contentEncrypted,
          iv: req.body.iv,
          salt: req.body.salt,
          type: 'text'
        });

        return res.json({ success: true, saved: true, id: botMessage.id, created_at: botMessage.created_at });
      }

      // This is a generate request
      const text = String(req.body?.message || "");
      const reply = await botService.reply(text);
      res.json({ success: true, reply });
    } catch (e: any) {
      console.error("[BOT] Error:", e);
      res.status(500).json({ error: "Failed to process bot request" });
    }
  }
};
