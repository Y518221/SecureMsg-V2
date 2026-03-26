import { getServiceRoleClient, supabaseAuth } from "../lib/supabase";
import crypto from "crypto";
import { encryptServer, decryptServer } from "../lib/serverCrypto";

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

  async searchBySecureId(secureId: string) {
    const db = getServiceRoleClient();
    const { data, error } = await db
      .from("users")
      .select("id, secure_id, username")
      .eq("secure_id", secureId)
      .single();
    if (error) throw error;
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
    const { data: sentMessages } = await db.from("messages").select("receiver_id").eq("sender_id", userId);
    const { data: receivedMessages } = await db.from("messages").select("sender_id").eq("receiver_id", userId);

    const userIds = new Set([
      ...(sentMessages?.map(m => m.receiver_id) || []),
      ...(receivedMessages?.map(m => m.sender_id) || [])
    ]);
    userIds.delete(userId);
    userIds.delete(null);

    if (userIds.size === 0) return [];

    const { data: users, error } = await db
      .from("users")
      .select("id, username, secure_id")
      .in("id", Array.from(userIds));

    if (error) throw error;
    return users.map(u => ({ ...u, username: decryptServer(u.username) }));
  }
};
