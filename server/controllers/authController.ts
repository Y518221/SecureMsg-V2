import { userService } from "../services/userService";

export const authController = {
  async register(req: any, res: any) {
    const { username, password } = req.body;
    try {
      const result = await userService.register(username, password);
      res.json({ success: true, ...result });
    } catch (e: any) {
      console.error("Registration error:", e);
      res.status(400).json({ error: e.message || "Registration failed" });
    }
  },

  async login(req: any, res: any) {
    const { username, password } = req.body;
    try {
      const result = await userService.login(username, password);
      res.json(result);
    } catch (e: any) {
      console.error("Login error:", e);
      res.status(401).json({ error: e.message || "Invalid credentials" });
    }
  },

  async getMe(req: any, res: any) {
    try {
      const user = await userService.getMe(req.userId);
      res.json(user);
    } catch (e: any) {
      res.status(404).json({ error: "User not found" });
    }
  },

  async search(req: any, res: any) {
    try {
      const user = await userService.searchBySecureId(req.params.secureId, req.userId);
      res.json(user);
    } catch (e: any) {
      res.status(404).json({ error: "User not found" });
    }
  },

  async deleteMe(req: any, res: any) {
    try {
      await userService.deleteMe(req.userId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  },

  async getConversations(req: any, res: any) {
    try {
      const conversations = await userService.getConversations(req.userId);
      res.json(conversations);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  },

  async removeConversation(req: any, res: any) {
    try {
      await userService.removeConversation(req.userId, req.params.contactId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(e.status || 500).json({ error: e.message || "Failed to remove contact" });
    }
  }
};
