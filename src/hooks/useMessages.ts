import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export function useMessages(token: string | null, userId?: string, activeChatId?: string, activeGroupId?: string) {
  const [messages, setMessages] = useState<any[]>([]);
  const [decryptedMessages, setDecryptedMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) return;

    const channels: any[] = [];
    const appendIfRelevant = (msg: any) => {
      if (activeGroupId) {
        if (msg.group_id !== activeGroupId) return;
      } else if (activeChatId && userId) {
        const isDirectPair =
          (msg.sender_id === userId && msg.receiver_id === activeChatId) ||
          (msg.sender_id === activeChatId && msg.receiver_id === userId);
        if (!isDirectPair) return;
      } else {
        return;
      }

      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    if (activeGroupId) {
      const groupChannel = supabase
        .channel(`messages-group-${activeGroupId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${activeGroupId}` },
          (payload) => appendIfRelevant(payload.new as any)
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'messages', filter: `group_id=eq.${activeGroupId}` },
          (payload) => setMessages(prev => prev.filter(m => m.id !== (payload.old as any).id))
        )
        .subscribe();
      channels.push(groupChannel);
    }

    if (!activeGroupId && activeChatId && userId) {
      const senderChannel = supabase
        .channel(`messages-direct-s-${activeChatId}-${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${activeChatId}` },
          (payload) => appendIfRelevant(payload.new as any)
        )
        .subscribe();
      const receiverChannel = supabase
        .channel(`messages-direct-r-${activeChatId}-${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${activeChatId}` },
          (payload) => appendIfRelevant(payload.new as any)
        )
        .subscribe();
      channels.push(senderChannel, receiverChannel);
    }

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [token, userId, activeChatId, activeGroupId]);

  return { messages, setMessages, decryptedMessages, setDecryptedMessages };
}
