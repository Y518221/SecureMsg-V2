import { getServiceRoleClient, supabaseAuth } from "../lib/supabase";
import crypto from "crypto";
import { encryptServer, decryptServer } from "../lib/serverCrypto";

const BOT_ID = "00000000-0000-0000-0000-000000000001";
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getHiddenContactIds(userId: string) {
  const db = getServiceRoleClient();
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error) throw error;

  const hidden = data.user?.user_metadata?.hidden_contact_ids;
  return Array.isArray(hidden) ? hidden.filter((id: unknown) => typeof id === "string") : [];
}

async function setHiddenContactIds(userId: string, hiddenContactIds: string[]) {
  const db = getServiceRoleClient();
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error) throw error;

  const userMetadata = data.user?.user_metadata || {};
  const { error: updateError } = await db.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...userMetadata,
      hidden_contact_ids: hiddenContactIds
    }
  });

  if (updateError) throw updateError;
}

export const userService = {
  async register(username: string, password: string) {
    const db = getServiceRoleClient();
    const email = `${username}@securemsg.local`;
    const secureId = crypto.randomUUID();
    
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, secure_id: secureId }
    });

    if (authError) throw authError;

    const userId = authData.user.id;
    const encryptedUsername = encryptServer(username);
    
    const { error: profileError } = await db
      .from("users")
      .insert([{ id: userId, secure_id: secureId, username: encryptedUsername }]);

    if (profileError) throw profileError;

    return { secureId };
  },

  async login(username: string, password: string) {
    const db = getServiceRoleClient();
    const email = `${username}@securemsg.local`;
    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });

    if (error) throw error;

    const metadata = data.user.user_metadata;
    if (metadata && metadata.secure_id) {
      return {
        token: data.session.access_token,
        user: { id: data.user.id, secure_id: metadata.secure_id, username: metadata.username || username }
      };
    }

    const { data: profile, error: profileError } = await db
      .from("users")
      .select("*")
      .eq("id", data.user.id)
      .single();

    if (profileError) throw profileError;

    return {
      token: data.session.access_token,
      user: { 
        id: profile.id, 
        secure_id: profile.secure_id, 
        username: decryptServer(profile.username) 
      }
    };
  },

  async getMe(userId: string) {
    const db = getServiceRoleClient();
    const { data, error } = await db
      .from("users")
      .select("id, secure_id, username")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return { ...data, username: decryptServer(data.username) };
  },

  async searchBySecureId(secureId: string, requesterId?: string) {
    const db = getServiceRoleClient();
    const { data, error } = await db
      .from("users")
      .select("id, secure_id, username")
      .eq("secure_id", secureId)
      .single();
    if (error) throw error;

    if (requesterId && data.id !== requesterId) {
      await this.restoreConversation(requesterId, data.id);
    }

    return { ...data, username: decryptServer(data.username) };
  },

  async deleteMe(userId: string) {
    const db = getServiceRoleClient();
    await db.from("users").delete().eq("id", userId);
    const { error } = await db.auth.admin.deleteUser(userId);
    if (error) throw error;
  },

  async getConversations(userId: string) {
    const db = getServiceRoleClient();
    const hiddenContactIds = new Set(await getHiddenContactIds(userId));
    const { data: sentMessages } = await db.from("messages").select("receiver_id").eq("sender_id", userId);
    const { data: receivedMessages } = await db.from("messages").select("sender_id").eq("receiver_id", userId);

    const userIds = new Set([
      ...(sentMessages?.map(m => m.receiver_id) || []),
      ...(receivedMessages?.map(m => m.sender_id) || [])
    ]);
    userIds.delete(userId);
    userIds.delete(null);
    userIds.delete(BOT_ID);
    hiddenContactIds.forEach(id => userIds.delete(id));

    if (userIds.size === 0) return [];

    const { data: users, error } = await db
      .from("users")
      .select("id, username, secure_id")
      .in("id", Array.from(userIds));

    if (error) throw error;
    return users.map(u => ({ ...u, username: decryptServer(u.username) }));
  },

  async removeConversation(userId: string, contactId: string) {
    if (!uuidRegex.test(contactId)) {
      const err: any = new Error("Invalid contact ID");
      err.status = 400;
      throw err;
    }

    if (contactId === userId) {
      const err: any = new Error("You cannot remove yourself from contacts");
      err.status = 400;
      throw err;
    }

    if (contactId === BOT_ID) {
      return;
    }

    const hidden = await getHiddenContactIds(userId);
    if (!hidden.includes(contactId)) {
      await setHiddenContactIds(userId, [...hidden, contactId]);
    }
  },

  async restoreConversation(userId: string, contactId: string) {
    const hidden = await getHiddenContactIds(userId);
    if (!hidden.includes(contactId)) return;

    await setHiddenContactIds(
      userId,
      hidden.filter(id => id !== contactId)
    );
  }
};
