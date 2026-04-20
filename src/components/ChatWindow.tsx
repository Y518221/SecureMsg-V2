import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, Unlock, Shield, Bot,
  ChevronLeft, Trash2, MoreVertical, CheckCircle2, ShieldAlert, AlertCircle, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { deriveKey, encryptData, decryptData, generateSalt } from '../lib/crypto';
import { api } from '../services/api';
import { ChatInput } from './ChatInput';
import { MessageBubble } from './MessageBubble';
import { SessionUnlock } from './SessionUnlock';
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

interface ChatWindowProps {
  user: any;
  token: string;
  chat: any;
  messages: any[];
  setMessages: any;
  sessionKey: CryptoKey | undefined;
  setSessionKey: (key: CryptoKey | undefined) => void;
  chatPassword: string | undefined;
  setChatPassword: (pw: string | undefined) => void;
  isGroup?: boolean;
  setSidebarOpen: (open: boolean) => void;
  onBack: () => void;
  setToast: (toast: {message: string, type: 'error' | 'success'}) => void;
  setGroups: any;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ 
  user, token, chat, messages, setMessages, 
  sessionKey, setSessionKey, chatPassword, setChatPassword,
  isGroup, setSidebarOpen, onBack, setToast,
  setGroups
}) => {
  const [input, setInput] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [decryptedMessages, setDecryptedMessages] = useState<Record<string, string>>({});
  const [keyCache, setKeyCache] = useState<Record<string, CryptoKey>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [confirmDeleteMessageId, setConfirmDeleteMessageId] = useState<string | null>(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const forceScrollToBottomRef = useRef(false);
  const isMountedRef = useRef(true);
  const BOT_ID = '00000000-0000-0000-0000-000000000001';
  const sortByCreatedAt = (rows: any[]) =>
    [...rows].sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      if (ta === tb) return String(a.id).localeCompare(String(b.id));
      return ta - tb;
    });

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  useEffect(() => {
    isMountedRef.current = true;
    shouldStickToBottomRef.current = true;
    forceScrollToBottomRef.current = true;
    const url = isGroup ? `/api/groups/${chat.id}/messages` : `/api/messages/${chat.id}`;
    let mounted = true;
    const fetchLatest = () => {
      api.get(url, token)
        .then(data => {
          if (!mounted) return;
          setMessages((prev: any[]) => {
            // Keep temporary/local-only messages (e.g. bot local replies) across polling refreshes.
            const localOnly = prev.filter((m: any) => {
              if (isUuid(String(m.id))) return false;
              if (isGroup) return m.group_id === chat.id;
              return (
                (m.sender_id === user.id && m.receiver_id === chat.id) ||
                (m.sender_id === chat.id && m.receiver_id === user.id)
              );
            });
            if (localOnly.length === 0) return data;
            const existing = new Set(data.map((m: any) => m.id));
            const merged = [...data];
            for (const msg of localOnly) {
              if (!existing.has(msg.id)) merged.push(msg);
            }
            return sortByCreatedAt(merged);
          });
        })
        .catch(console.error);
    };

    fetchLatest();
    const intervalId = window.setInterval(fetchLatest, 3000);
    window.addEventListener('focus', fetchLatest);

    return () => {
      mounted = false;
      isMountedRef.current = false;
      clearInterval(intervalId);
      window.removeEventListener('focus', fetchLatest);
    };
  }, [chat.id, isGroup, token, setMessages, user.id]);

  const isNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    if (forceScrollToBottomRef.current || shouldStickToBottomRef.current) {
      scrollToBottom();
      forceScrollToBottomRef.current = false;
    }
  }, [messages.length, decryptedMessages]);

  // Re-decrypt messages when sessionKey changes or messages change
  useEffect(() => {
    if (chatPassword && messages.length > 0) {
      const decryptAll = async () => {
        const newDecrypted: Record<string, string> = {};
        const newKeyCache: Record<string, CryptoKey> = { ...keyCache };
        let hasNew = false;
        let cacheChanged = false;
        
        for (const msg of messages) {
          if (decryptedMessages[msg.id]) continue;

          try {
            // Get or derive key for this specific salt
            let msgKey = newKeyCache[msg.salt];
            if (!msgKey) {
              msgKey = await deriveKey(chatPassword, msg.salt);
              newKeyCache[msg.salt] = msgKey;
              cacheChanged = true;
            }

            const text = await decryptData(msg.content_encrypted, msg.iv, msgKey);
            newDecrypted[msg.id] = text;
            hasNew = true;
          } catch (e) {}
        }
        
        if (cacheChanged) setKeyCache(newKeyCache);
        if (hasNew) {
          setDecryptedMessages(prev => ({ ...prev, ...newDecrypted }));
        }
      };
      decryptAll();
    }
  }, [chatPassword, messages]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockPassword.trim()) {
      setToast({ message: "Please enter a session password", type: 'error' });
      return;
    }
    setIsUnlocking(true);
    try {
      let key: CryptoKey;
      let verifiedSalt = "fixed-salt-for-demo";

      if (messages.length > 0) {
        // Verify password against real encrypted messages before unlocking.
        // We try the most recent few messages to avoid false positives.
        const recentMessages = [...messages].reverse().slice(0, 8);
        let matched = false;

        for (const msg of recentMessages) {
          try {
            const candidateKey = await deriveKey(unlockPassword, msg.salt);
            await decryptData(msg.content_encrypted, msg.iv, candidateKey);
            key = candidateKey;
            verifiedSalt = msg.salt;
            matched = true;
            break;
          } catch {}
        }

        if (!matched) {
          setToast({ message: "Incorrect password. Unable to decrypt messages.", type: 'error' });
          return;
        }
      } else {
        // No messages yet: cannot verify, so derive a placeholder session key.
        key = await deriveKey(unlockPassword, verifiedSalt);
      }

      setSessionKey(key!);
      setChatPassword(unlockPassword);
      setKeyCache({ [verifiedSalt]: key! });
      setToast({ message: "Session unlocked successfully", type: 'success' });
      setUnlockPassword('');
    } catch (e) {
      setToast({ message: "Invalid session key or decryption error", type: 'error' });
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionKey) return;

    setIsUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const base64 = dataUrl.split(',')[1];
      const payload = `${file.name}|${base64}`;
      const salt = generateSalt();
      const key = keyCache[salt] || await deriveKey(chatPassword!, salt);
      if (!keyCache[salt]) setKeyCache(prev => ({ ...prev, [salt]: key }));

      const { content, iv } = await encryptData(payload, key);
      
      const data = await api.post('/api/messages/send', {
        receiverId: !isGroup ? chat.id : undefined,
        groupId: isGroup ? chat.id : undefined,
        contentEncrypted: content,
        iv,
        salt,
        type: 'file'
      }, token);

      if (data.success) {
        forceScrollToBottomRef.current = true;
        setDecryptedMessages(prev => ({ ...prev, [data.id]: payload }));
        setToast({ message: "File sent securely", type: 'success' });
      }
    } catch (e) {
      setToast({ message: "Failed to encrypt or upload file", type: 'error' });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const downloadFile = (decryptedContent: string) => {
    try {
      const [filename, base64] = decryptedContent.split('|');
      const byteCharacters = atob(base64 || decryptedContent);
      const byteArray = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteArray[i] = byteCharacters.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([byteArray]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'file';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setToast({ message: "Download failed", type: 'error' });
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chatPassword) return;

    try {
      const sentAt = new Date().toISOString();
      const salt = generateSalt(); // Unique salt per message
      const key = keyCache[salt] || await deriveKey(chatPassword, salt);
      if (!keyCache[salt]) setKeyCache(prev => ({ ...prev, [salt]: key }));

      const { content, iv } = await encryptData(input, key);
      const data = await api.post('/api/messages/send', {
        receiverId: !isGroup ? chat.id : undefined,
        groupId: isGroup ? chat.id : undefined,
        contentEncrypted: content,
        iv,
        salt,
        type: 'text'
      }, token);

      if (data.success) {
        forceScrollToBottomRef.current = true;
        const serverCreatedAt = data.created_at || sentAt;
        const sentMsg = {
          id: data.id,
          sender_id: data.sender_id ?? user.id,
          receiver_id: data.receiver_id ?? (!isGroup ? chat.id : null),
          group_id: data.group_id ?? (isGroup ? chat.id : null),
          content_encrypted: content,
          iv,
          salt,
          type: data.type || 'text',
          created_at: serverCreatedAt
        };
        setMessages((prev: any[]) => {
          if (prev.some(m => m.id === data.id)) return prev;
          return sortByCreatedAt([...prev, sentMsg]);
        });
        setDecryptedMessages(prev => ({ ...prev, [data.id]: input }));
        setInput('');

        if (chat.id === BOT_ID) {
          handleBotReply(input, serverCreatedAt);
        }
      }
    } catch (e) {
      setToast({ message: "Failed to send message", type: 'error' });
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    setIsDeleting(true);
    try {
      if (!isUuid(messageId)) {
        setMessages((prev: any[]) => prev.filter(m => m.id !== messageId));
        setDecryptedMessages(prev => {
          const next = { ...prev };
          delete next[messageId];
          return next;
        });
        return;
      }

      await api.delete(`/api/messages/${messageId}`, token);
      setMessages((prev: any[]) => prev.filter(m => m.id !== messageId));
      setDecryptedMessages(prev => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
      const url = isGroup ? `/api/groups/${chat.id}/messages` : `/api/messages/${chat.id}`;
      const fresh = await api.get(url, token);
      setMessages(fresh);
      setToast({ message: "Message deleted", type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || "Delete failed", type: 'error' });
    } finally {
      setIsDeleting(false);
      setConfirmDeleteMessageId(null);
    }
  };

  const handleDeleteGroup = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/api/groups/${chat.id}`, token);
      setGroups((prev: any[]) => prev.filter(g => g.id !== chat.id));
      onBack();
      setToast({ message: "Group deleted", type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    } finally {
      setIsDeleting(false);
      setConfirmDeleteGroup(false);
    }
  };

  const handleBotReply = async (userInput: string, minCreatedAt?: string) => {
    let responseText = "Support bot is temporarily unavailable.";
    try {
      const resp = await api.post('/api/messages/bot-reply', { message: userInput }, token);
      responseText = resp?.reply || responseText;
    } catch {
      responseText = "Support bot is temporarily unavailable.";
    }

    const salt = generateSalt();
    const key = keyCache[salt] || await deriveKey(chatPassword!, salt);
    if (!keyCache[salt]) setKeyCache(prev => ({ ...prev, [salt]: key }));

    const botEnc = await encryptData(responseText, key);
    const minTs = minCreatedAt ? new Date(minCreatedAt).getTime() : 0;
    const safeCreatedAt = Number.isFinite(minTs) && minTs > 0
      ? new Date(minTs + 1).toISOString()
      : new Date().toISOString();
    const botMsg = {
      id: Math.random().toString(),
      sender_id: BOT_ID,
      receiver_id: user.id,
      content_encrypted: botEnc.content,
      iv: botEnc.iv,
      salt,
      type: 'text',
      created_at: safeCreatedAt
    };
    if (!isMountedRef.current || chat.id !== BOT_ID) return;
    forceScrollToBottomRef.current = true;
    setMessages((prev: any[]) => sortByCreatedAt([...prev, botMsg]));
    setDecryptedMessages(prev => ({ ...prev, [botMsg.id]: responseText }));
  };

  const copyGroupId = async () => {
    try {
      await navigator.clipboard.writeText(chat.id);
      setToast({ message: "Group ID copied", type: 'success' });
    } catch {
      setToast({ message: "Failed to copy Group ID", type: 'error' });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="h-16 border-b border-zinc-800/50 flex items-center justify-between px-3 lg:px-6 bg-[#0d0d0f]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2 lg:gap-3">
          <button onClick={onBack} className="lg:hidden p-2 text-zinc-500 hover:text-zinc-200">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="hidden sm:flex w-8 h-8 rounded-lg bg-zinc-800 items-center justify-center">
            {chat.id.includes('00000000') ? <Bot className="w-4 h-4 text-emerald-400" /> : <Shield className="w-4 h-4 text-emerald-400" />}
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-bold truncate max-w-[120px] sm:max-w-none">{chat.username || chat.name}</h3>
            <div className="flex items-center gap-1.5">
              {sessionKey ? (
                <span className="flex items-center gap-1 text-[9px] sm:text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
                  <Unlock className="w-2.5 h-2.5 sm:w-3 h-3" /> Unlocked
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[9px] sm:text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                  <Lock className="w-2.5 h-2.5 sm:w-3 h-3" /> Encrypted
                </span>
              )}
              {isGroup && (
                <button
                  onClick={copyGroupId}
                  className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] text-zinc-400 hover:text-emerald-400 transition-colors font-mono"
                  title={chat.id}
                >
                  <Copy className="w-3 h-3" />
                  {chat.id.slice(0, 8)}...
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 lg:gap-4">
          <button 
            onClick={() => {
              setSessionKey(undefined);
              setChatPassword(undefined);
              setDecryptedMessages({});
            }}
            className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-red-400 transition-colors px-2 py-1"
          >
            Lock
          </button>
          <div className="hidden xs:flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 rounded-full px-2 sm:px-3 py-1">
            <div className={cn("w-1.5 h-1.5 rounded-full", sessionKey ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-zinc-600")} />
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              {sessionKey ? "Active" : "Locked"}
            </span>
          </div>
          {isGroup && (
            <button 
              onClick={() => setConfirmDeleteGroup(true)}
              className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-zinc-500">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className={cn(
        "px-6 py-2 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-4 border-b border-zinc-800/30",
        sessionKey ? "bg-emerald-500/5 text-emerald-500/80" : "bg-zinc-900/50 text-zinc-600"
      )}>
        <span className="flex items-center gap-1.5">
          {sessionKey ? <CheckCircle2 className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
          State: {sessionKey ? "Unlocked" : "Locked"}
        </span>
        <span className="w-1 h-1 rounded-full bg-zinc-800" />
        <span>Meaning: {sessionKey ? "Session Active" : "Messages Encrypted"}</span>
        <span className="w-1 h-1 rounded-full bg-zinc-800" />
        <span className="flex items-center gap-1.5">
          <AlertCircle className="w-3 h-3" />
          Persistence: Temporary
        </span>
      </div>

      <div
        ref={scrollRef}
        onScroll={() => {
          shouldStickToBottomRef.current = isNearBottom();
        }}
        className="flex-1 overflow-y-auto p-6 space-y-4"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
            <Lock className="w-12 h-12 mb-4 text-zinc-700" />
            <p className="text-sm font-medium">This conversation is encrypted.<br />Start by unlocking the session.</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isMe={msg.sender_id === user.id}
            decryptedText={decryptedMessages[msg.id]}
            onDownload={downloadFile}
            onDelete={(id) => setConfirmDeleteMessageId(id)}
          />
        ))}
      </div>

      <div className="p-3 sm:p-6 bg-[#0a0a0c]">
        {!sessionKey ? (
          <SessionUnlock
            unlockPassword={unlockPassword}
            setUnlockPassword={setUnlockPassword}
            onUnlock={handleUnlock}
            isUnlocking={isUnlocking}
          />
        ) : (
          <ChatInput
            input={input}
            setInput={setInput}
            onSend={sendMessage}
            onFileUpload={handleFileUpload}
            fileInputRef={fileInputRef}
          />
        )}
      </div>

      <AnimatePresence>
        {(confirmDeleteMessageId || confirmDeleteGroup) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-[#111113] p-5 shadow-2xl"
            >
              <h4 className="text-base font-bold text-zinc-100">
                {confirmDeleteGroup ? "Delete group?" : "Delete message?"}
              </h4>
              <p className="mt-2 text-sm text-zinc-400">
                {confirmDeleteGroup
                  ? "This action removes the group and cannot be undone."
                  : "This message will be removed permanently."}
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  disabled={isDeleting}
                  onClick={() => {
                    setConfirmDeleteMessageId(null);
                    setConfirmDeleteGroup(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  disabled={isDeleting}
                  onClick={() => {
                    if (confirmDeleteGroup) handleDeleteGroup();
                    else if (confirmDeleteMessageId) handleDeleteMessage(confirmDeleteMessageId);
                  }}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
