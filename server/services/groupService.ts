import { getServiceRoleClient } from "../lib/supabase";
import crypto from "crypto";
import { encryptServer } from "../lib/serverCrypto";

async function ensureUserProfile(db: any, userId: string, userMetadata?: any) {
  const { data: existingUser, error: existingUserError } = await db
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existingUserError) {
    const err: any = new Error(existingUserError.message || "Failed to verify user profile");
    err.status = 500;
    throw err;
  }

  if (existingUser) return;

  const metadata = userMetadata || {};
  const baseUsername = metadata.username || `user_${userId.slice(0, 8)}`;
  const baseSecureId = metadata.secure_id || crypto.randomUUID();

  for (let attempt = 0; attempt < 3; attempt++) {
    const secureId = attempt === 0 ? baseSecureId : crypto.randomUUID();
    const username = attempt === 0 ? baseUsername : `${baseUsername}_${crypto.randomUUID().slice(0, 6)}`;

    const { error: insertProfileError } = await db.from("users").insert([
      {
        id: userId,
        secure_id: secureId,
        username: encryptServer(username),
      },
    ]);

    if (!insertProfileError) return;

    if (insertProfileError.code === "23505") {
      continue;
    }

    const err: any = new Error(insertProfileError.message || "Failed to initialize user profile");
    err.status = 500;
    throw err;
  }

  const err: any = new Error("Failed to initialize user profile");
  err.status = 500;
  throw err;
}

export const groupService = {
  async create(userId: string, name: string, userMetadata?: any) {
    const db = getServiceRoleClient();
    if (!name || !name.trim()) {
      const err: any = new Error("Group name is required");
      err.status = 400;
      throw err;
    }

    await ensureUserProfile(db, userId, userMetadata);

    const { data: group, error: groupError } = await db
      .from("groups")
      .insert([{ name: name.trim(), owner_id: userId }])
      .select()
      .single();

    if (groupError) {
      const err: any = new Error(groupError.message || "Failed to create group");
      err.status = 500;
      throw err;
    }

    const { error: memberError } = await db
      .from("group_members")
      .insert([{ group_id: group.id, user_id: userId }]);

    if (memberError) {
      await db.from("groups").delete().eq("id", group.id);
      const err: any = new Error(memberError.message || "Failed to add group member");
      err.status = 500;
      throw err;
    }

    return group;
  },

  async list(userId: string) {
    const db = getServiceRoleClient();
    const { data, error } = await db
      .from("group_members")
      .select("groups(*)")
      .eq("user_id", userId);

    if (error) throw error;
    return data.map(item => item.groups).filter(Boolean);
  },

  async join(userId: string, groupId: string, userMetadata?: any) {
    const db = getServiceRoleClient();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(groupId)) {
      const err: any = new Error("Invalid group ID");
      err.status = 400;
      throw err;
    }

    await ensureUserProfile(db, userId, userMetadata);

    const { data: group, error: groupError } = await db
      .from("groups")
      .select("id, name")
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

    const { error: memberError } = await db
      .from("group_members")
      .upsert([{ group_id: groupId, user_id: userId }], { onConflict: "group_id,user_id" });

    if (memberError) {
      const err: any = new Error(memberError.message || "Failed to join group");
      err.status = 500;
      throw err;
    }

    return group;
  },

  async delete(userId: string, groupId: string) {
    const db = getServiceRoleClient();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(groupId)) {
      const err: any = new Error("Invalid group ID");
      err.status = 400;
      throw err;
    }

    const { error: deleteError } = await db
      .from("groups")
      .delete()
      .eq("id", groupId)
      .eq("owner_id", userId);

    if (!deleteError) {
      const { data: remainingGroup, error: verifyError } = await db
        .from("groups")
        .select("id")
        .eq("id", groupId)
        .maybeSingle();
      if (verifyError) {
        const err: any = new Error(verifyError.message || "Failed to verify group deletion");
        err.status = 500;
        throw err;
      }
      if (!remainingGroup) return;
    }

    // Fallback for schemas without ON DELETE CASCADE: remove known dependencies then retry once.
    if (deleteError?.code === "23503") {
      const { error: memberDeleteError } = await db
        .from("group_members")
        .delete()
        .eq("group_id", groupId);
      if (memberDeleteError) {
        const err: any = new Error(memberDeleteError.message || "Failed to remove group members");
        err.status = 500;
        throw err;
      }

      const { error: messageDeleteError } = await db
        .from("messages")
        .delete()
        .eq("group_id", groupId);
      if (messageDeleteError) {
        const err: any = new Error(messageDeleteError.message || "Failed to remove group messages");
        err.status = 500;
        throw err;
      }

      const { error: retryDeleteError } = await db
        .from("groups")
        .delete()
        .eq("id", groupId)
        .eq("owner_id", userId);

      if (!retryDeleteError) {
        const { data: remainingAfterRetry, error: verifyRetryError } = await db
          .from("groups")
          .select("id, owner_id")
          .eq("id", groupId)
          .maybeSingle();
        if (verifyRetryError) {
          const err: any = new Error(verifyRetryError.message || "Failed to verify group deletion");
          err.status = 500;
          throw err;
        }
        if (!remainingAfterRetry) return;
      }

      const err: any = new Error(retryDeleteError?.message || "Group delete failed");
      err.status = 500;
      throw err;
    }

    const { data: remainingGroup, error: remainingGroupError } = await db
      .from("groups")
      .select("id, owner_id")
      .eq("id", groupId)
      .maybeSingle();

    if (remainingGroupError) {
      const err: any = new Error(remainingGroupError.message || "Failed to verify group state");
      err.status = 500;
      throw err;
    }

    if (!remainingGroup) return;

    if (remainingGroup.owner_id !== userId) {
      const err: any = new Error("Only the owner can delete the group");
      err.status = 403;
      throw err;
    }

    const err: any = new Error(deleteError?.message || "Group delete failed");
    err.status = 500;
    throw err;
  }
};
