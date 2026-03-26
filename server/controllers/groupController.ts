import { groupService } from "../services/groupService";

export const groupController = {
  async create(req: any, res: any) {
    try {
      const group = await groupService.create(req.userId, req.body.name, req.authUser?.user_metadata);
      res.json({ success: true, id: group.id });
    } catch (e: any) {
      console.error("Group create error:", e);
      res.status(e.status || 500).json({ error: e.message || "Failed to create group" });
    }
  },

  async list(req: any, res: any) {
    try {
      const groups = await groupService.list(req.userId);
      res.json(groups);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to fetch groups" });
    }
  },

  async join(req: any, res: any) {
    try {
      const group = await groupService.join(req.userId, req.params.groupId, req.authUser?.user_metadata);
      res.json({ success: true, group });
    } catch (e: any) {
      res.status(e.status || 500).json({ error: e.message || "Failed to join group" });
    }
  },

  async delete(req: any, res: any) {
    try {
      await groupService.delete(req.userId, req.params.groupId);
      res.json({ success: true });
    } catch (e: any) {
      console.error("Group delete error:", e);
      res.status(e.status || 500).json({ error: e.message || "Failed to delete group" });
    }
  }
};
