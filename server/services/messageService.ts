import { getServiceRoleClient } from "../lib/supabase.js";

async function assertGroupAccess(db: any, userId: string, groupId: string) {
  const { data: group, error: groupError } = await db
    .from("groups")
    .select("id, owner_id")
    .eq("id", groupId)
    .maybeSingle();

  if (groupError) {
    const err: any = new Error(groupError.message || "Failed to verify group");
    err.status = 500;
    throw err;
  }
  if (!group) {
    const err: any = new Error("Group not found");
    err.status = 404;
    throw err;
  }
  if (group.owner_id === userId) return;

  const { data: membership, error: membershipError } = await db
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) {
    const err: any = new Error(membershipError.message || "Failed to verify group membership");
    err.status = 500;
    throw err;
  }
  if (!membership) {
    const err: any = new Error("You are not allowed to access this group");
    err.status = 403;
    throw err;
  }
}

export const messageService = {
  async send(senderId: string, payload: any) {
    const db = getServiceRoleClient();
    const { receiverId, groupId, contentEncrypted, iv, salt, type } = payload;
    if (!contentEncrypted || !iv || !salt) {
      const err: any = new Error("Missing encrypted payload fields");
      err.status = 400;
      throw err;
    }
    if (!receiverId && !groupId) {
      const err: any = new Error("receiverId or groupId is required");
      err.status = 400;
      throw err;
    }
    if (receiverId && groupId) {
      const err: any = new Error("Message cannot target both receiver and group");
      err.status = 400;
      throw err;
    }
    if (groupId) {
      await assertGroupAccess(db, senderId, groupId);
    }
    const { data, error } = await db
      .from("messages")
      .insert([{
        sender_id: senderId,
        receiver_id: receiverId || null,
        group_id: groupId || null,
        content_encrypted: contentEncrypted,
        iv,
        salt,
        type: type || 'text'
      }])
      .select()
      .single();

    if (error) {
      console.error("Supabase Message Insert Error:", error);
      console.error("Payload attempted:", { senderId, receiverId, groupId, type });
      throw error;
    }
    return data;
  },

  async getDirectMessages(userId: string, otherId: string) {
    const db = getServiceRoleClient();
    const { data, error } = await db
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data;
  },

  async getGroupMessagesForUser(userId: string, groupId: string) {
    const db = getServiceRoleClient();
    await assertGroupAccess(db, userId, groupId);
    const { data, error } = await db
      .from("messages")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data;
  },

  async saveBotReply(receiverId: string, payload: any) {
    const db = getServiceRoleClient();
    const { contentEncrypted, iv, salt, type } = payload;
    if (!contentEncrypted || !iv || !salt) {
      const err: any = new Error("Missing encrypted bot payload fields");
      err.status = 400;
      throw err;
    }

    const { data, error } = await db
      .from("messages")
      .insert([{
        sender_id: "00000000-0000-0000-0000-000000000001",
        receiver_id: receiverId,
        group_id: null,
        content_encrypted: contentEncrypted,
        iv,
        salt,
        type: type || 'text'
      }])
      .select()
      .single();

    if (error) {
      console.error("Supabase Bot Message Insert Error:", error);
      throw error;
    }

    return data;
  },

  async delete(userId: string, messageId: string) {
    const db = getServiceRoleClient();
    // Validate UUID format to prevent Supabase errors
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(messageId)) {
      console.error("Invalid Message ID format:", messageId);
      const err: any = new Error("Invalid message ID");
      err.status = 400;
      throw err;
    }

    const { data: message, error: fetchError } = await db
      .from("messages")
      .select("sender_id")
      .eq("id", messageId)
      .maybeSingle();

    if (fetchError) {
      console.error("Delete Message Fetch Error:", fetchError);
      const err: any = new Error("Failed to verify message ownership");
      err.status = 500;
      throw err;
    }
    
    if (!message) {
      console.warn("Delete Message: Message not found or already deleted:", messageId);
      return; // Already gone, consider it success
    }
    
    if (message.sender_id !== userId) {
      console.error("Delete Message Unauthorized:", { userId, senderId: message.sender_id });
      const err: any = new Error("You can only delete your own messages");
      err.status = 403;
      throw err;
    }

    const { data: deletedRow, error: deleteError } = await db
      .from("messages")
      .delete()
      .eq("id", messageId)
      .eq("sender_id", userId)
      .select("id")
      .maybeSingle();

    if (deleteError) {
      console.error("Delete Message Supabase Error:", deleteError);
      const err: any = new Error("Database error during deletion");
      err.status = 500;
      throw err;
    }

    if (!deletedRow) {
      const err: any = new Error("Message was not deleted");
      err.status = 500;
      throw err;
    }
    
    console.log("Successfully deleted message:", messageId);
  }
};
