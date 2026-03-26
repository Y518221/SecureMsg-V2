import React, { useState, useEffect } from 'react';
import { 
  Shield, Search, UserPlus, Users, 
  Trash2, LogOut, Bot, Eye, EyeOff, Menu, X, MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { useAuth } from './hooks/useAuth';
import { useMessages } from './hooks/useMessages';
import { api } from './services/api';
import { supabase } from './services/supabase';
import { Toast } from './components/Toast';
import { ChatItem } from './components/ChatItem';
import { ChatWindow } from './components/ChatWindow';
import { HomeView } from './components/HomeView';
import { AboutView } from './components/AboutView';
import { AuthView } from './components/AuthView';

export default function App() {
  const { user, token, setToken, setUser, logout, loading } = useAuth();
  const [view, setView] = useState<'home' | 'about' | 'login' | 'register' | 'chat'>('home');
  const [activeChat, setActiveChat] = useState<any>(null);
  const [activeGroup, setActiveGroup] = useState<any>(null);
  const { messages, setMessages } = useMessages(token, user?.id, activeChat?.id, activeGroup?.id);
  
  const [sessionKeys, setSessionKeys] = useState<Record<string, CryptoKey>>({});
  const [chatPasswords, setChatPasswords] = useState<Record<string, string>>({});
  
  const [showId, setShowId] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [groups, setGroups] = useState<any[]>([]);
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<{message: string, type: 'error' | 'success'} | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchConversations = () => {
    if (!token) return;
    api.get('/api/auth/conversations', token).then(setRecentChats).catch(console.error);
  };

  const fetchGroups = async (notifyIfRemoved = false) => {
    if (!token) return;
    try {
      const latestGroups = await api.get('/api/groups', token);
      const latestIds = new Set(latestGroups.map((g: any) => g.id));

      setGroups(latestGroups);

      setActiveGroup(prev => {
        if (!prev) return prev;
        if (latestIds.has(prev.id)) return prev;

        if (notifyIfRemoved) {
          setToast({ message: "Group was deleted by owner", type: 'error' });
        }
        return null;
      });

      // Do not globally prune session/chat state here.
      // This map also stores direct chat keys, which are not group IDs.
      // Group-specific cleanup is handled when a group is actually removed.
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (token && user) {
      supabase.realtime.setAuth(token);
      setView('chat');
      fetchGroups();
      fetchConversations();
    } else if (!loading && !token) {
      if (view === 'chat') setView('home');
    }
  }, [token, user, loading]);

  useEffect(() => {
    if (!token || !user) return;

    const intervalId = setInterval(() => {
      fetchGroups(true);
    }, 5000);

    const onFocus = () => fetchGroups(true);
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, [token, user]);

  useEffect(() => {
    if (!token || !user?.id) return;

    const refreshConversations = () => fetchConversations();
    const intervalId = setInterval(refreshConversations, 5000);
    const onFocus = () => refreshConversations();
    window.addEventListener('focus', onFocus);

    const channel = supabase
      .channel(`conversations-sync-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        (payload) => {
          const msg = payload.new as any;
          if (msg?.group_id) return;
          refreshConversations();
          if (msg?.sender_id && msg.sender_id !== user.id && activeChat?.id !== msg.sender_id) {
            setUnreadCounts(prev => ({ ...prev, [msg.sender_id]: (prev[msg.sender_id] || 0) + 1 }));
          }
          if (activeChat?.id !== msg.sender_id) {
            setToast({ message: "New message received", type: 'success' });
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      supabase.removeChannel(channel);
    };
  }, [token, user?.id, activeChat?.id]);

  useEffect(() => {
    if (!activeChat?.id) return;
    setUnreadCounts(prev => {
      if (!prev[activeChat.id]) return prev;
      const next = { ...prev };
      delete next[activeChat.id];
      return next;
    });
  }, [activeChat?.id]);

  useEffect(() => {
    if (!token || !user?.id) return;

    const removeGroupLocally = (groupId: string, showRemovedToast = false) => {
      let wasMember = false;
      let wasActive = false;

      setGroups(prev => {
        wasMember = prev.some(g => g.id === groupId);
        return prev.filter(g => g.id !== groupId);
      });
      setActiveGroup(prev => {
        wasActive = prev?.id === groupId;
        return wasActive ? null : prev;
      });
      setSessionKeys(prev => {
        if (!prev[groupId]) return prev;
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
      setChatPasswords(prev => {
        if (!prev[groupId]) return prev;
        const next = { ...prev };
        delete next[groupId];
        return next;
      });

      if (showRemovedToast && (wasMember || wasActive)) {
        setToast({ message: "Group was deleted by owner", type: 'error' });
      }
    };

    const channel = supabase
      .channel(`groups-sync-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'group_members', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const groupId = (payload.old as any)?.group_id as string | undefined;
          if (groupId) removeGroupLocally(groupId, true);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'groups' },
        (payload) => {
          const groupId = (payload.old as any)?.id as string | undefined;
          if (groupId) removeGroupLocally(groupId, true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [token, user?.id]);

  const handleLogout = () => {
    logout();
    setSessionKeys({});
    setChatPasswords({});
    setUnreadCounts({});
    setView('login');
  };

  const handleDeleteAccount = async () => {
    if (!token) return;
    setIsDeletingAccount(true);
    try {
      await api.delete('/api/auth/me', token);
      handleLogout();
    } catch (e: any) {
      setToast({ message: e.message || "Failed to delete account", type: 'error' });
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteAccountConfirm(false);
    }
  };

  if (loading) return <div className="h-screen bg-[#050505] flex items-center justify-center text-emerald-500 font-bold">Loading Secure Session...</div>;

  if (view === 'home') return <HomeView setView={setView} user={user} />;
  if (view === 'about') return <AboutView setView={setView} user={user} />;
  if (view === 'login' || view === 'register') return <AuthView view={view} setView={setView} setToken={setToken} setUser={setUser} />;

  const chat = activeChat || activeGroup;

  return (
    <div className="flex h-[100dvh] w-full bg-[#0a0a0c] text-zinc-100 font-sans overflow-hidden relative">
      <Toast toast={toast} />
      
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-80 border-r border-zinc-800/50 flex flex-col bg-[#0d0d0f] transition-transform duration-300 lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-zinc-800/50">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-emerald-500" />
              <h1 className="text-xl font-bold tracking-tight">SecureMsg</h1>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50 relative group">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">My Secure ID</p>
                <button onClick={() => setShowId(!showId)} className="text-zinc-500 hover:text-emerald-500 transition-colors">
                  {showId ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
              <p className={cn("text-xs font-mono break-all transition-all", showId ? "text-emerald-400" : "text-zinc-800 select-none blur-[2px]")}>
                {user?.secure_id}
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input 
                id="search-secure-id"
                name="searchSecureId"
                type="text" 
                placeholder="Search by Secure ID or Group ID..." 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const query = searchId.trim();
                    if (!query) return;

                    try {
                      const data = await api.get(`/api/auth/search/${encodeURIComponent(query)}`, token!);
                      setActiveChat(data);
                      setActiveGroup(null);
                      setSidebarOpen(false);
                      setSearchId('');
                      setRecentChats(prev => prev.some(c => c.id === data.id) ? prev : [data, ...prev]);
                      return;
                    } catch {}

                    try {
                      const data = await api.post(`/api/groups/join/${query}`, {}, token!);
                      const joinedGroup = data.group;
                      setGroups(prev => prev.some(g => g.id === joinedGroup.id) ? prev : [...prev, joinedGroup]);
                      setActiveGroup(joinedGroup);
                      setActiveChat(null);
                      setSidebarOpen(false);
                      setSearchId('');
                      setToast({ message: "Joined group", type: 'success' });
                    } catch {
                      setToast({ message: "User or group not found", type: 'error' });
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-3 px-2">
              <h2 className="text-[11px] uppercase tracking-widest text-zinc-500 font-bold">Recent Chats</h2>
            </div>
            <div className="space-y-1">
              <ChatItem 
                active={activeChat?.id === '00000000-0000-0000-0000-000000000001'} 
                onClick={() => {
                  setActiveChat({ id: '00000000-0000-0000-0000-000000000001', secure_id: 'SECURE-BOT-999', username: 'Support Bot' });
                  setActiveGroup(null);
                  setUnreadCounts(prev => {
                    if (!prev['00000000-0000-0000-0000-000000000001']) return prev;
                    const next = { ...prev };
                    delete next['00000000-0000-0000-0000-000000000001'];
                    return next;
                  });
                  setSidebarOpen(false);
                }}
                icon={<Bot className="w-4 h-4" />}
                title="Support Bot"
                badge={unreadCounts['00000000-0000-0000-0000-000000000001']}
              />
              {recentChats.map(c => (
                <ChatItem 
                  key={c.id}
                  active={activeChat?.id === c.id}
                  onClick={() => {
                    setActiveChat(c);
                    setActiveGroup(null);
                    setUnreadCounts(prev => {
                      if (!prev[c.id]) return prev;
                      const next = { ...prev };
                      delete next[c.id];
                      return next;
                    });
                    setSidebarOpen(false);
                  }}
                  icon={<Shield className="w-4 h-4" />}
                  title={c.username}
                  badge={unreadCounts[c.id]}
                />
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3 px-2">
              <h2 className="text-[11px] uppercase tracking-widest text-zinc-500 font-bold">Secure Groups</h2>
              <Users className="w-4 h-4 text-zinc-500 cursor-pointer hover:text-zinc-300" onClick={() => setShowCreateGroup(true)} />
            </div>
            <div className="space-y-1">
              {groups.map(g => (
                <ChatItem 
                  key={g.id}
                  active={activeGroup?.id === g.id}
                  onClick={() => { setActiveGroup(g); setActiveChat(null); setSidebarOpen(false); }}
                  icon={<Users className="w-4 h-4" />}
                  title={g.name}
                  subtitle={`ID: ${g.id}`}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="p-4 border-t border-zinc-800/50 bg-zinc-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold text-xs">
                {(user?.username?.[0] || '?').toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">{user?.username}</p>
                <p className="text-[10px] text-zinc-500">Online</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowDeleteAccountConfirm(true)}
                className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={handleLogout} className="p-2 text-zinc-500 hover:text-red-400 transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-0 relative bg-[#0a0a0c]">
        {chat ? (
          <ChatWindow 
            user={user!} 
            token={token!} 
            chat={chat} 
            isGroup={!!activeGroup}
            messages={messages} 
            setMessages={setMessages}
            sessionKey={sessionKeys[chat.id]}
            setSessionKey={(key) => setSessionKeys(prev => ({ ...prev, [chat.id]: key }))}
            chatPassword={chatPasswords[chat.id]}
            setChatPassword={(pw) => setChatPasswords(prev => ({ ...prev, [chat.id]: pw }))}
            setSidebarOpen={setSidebarOpen}
            onBack={() => { setActiveChat(null); setActiveGroup(null); }}
            setToast={setToast}
            setGroups={setGroups}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center relative">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden absolute top-4 left-4 p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-zinc-400">
              <Menu className="w-6 h-6" />
            </button>
            <div className="w-20 h-20 rounded-3xl bg-zinc-900 flex items-center justify-center mb-6 border border-zinc-800">
              <Shield className="w-10 h-10 text-zinc-700" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Secure End-to-End Chat</h2>
            <p className="text-zinc-500 max-w-md">Select a contact or search by Secure ID to start an encrypted session.</p>
          </div>
        )}
      </main>

      <AnimatePresence>
        {showCreateGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-md bg-[#0d0d0f] border border-zinc-800 rounded-3xl p-8 shadow-2xl">
              <h3 className="text-xl font-bold mb-4">Create Secure Group</h3>
              <div className="space-y-4">
                <input id="new-group-name" name="groupName" type="text" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50" placeholder="Group Name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowCreateGroup(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3 rounded-xl transition-all">Cancel</button>
                  <button
                    disabled={isCreatingGroup}
                    onClick={async () => {
                      const trimmed = newGroupName.trim();
                      if (!trimmed) {
                        setToast({ message: "Group name is required", type: 'error' });
                        return;
                      }

                      setIsCreatingGroup(true);
                      try {
                        const data = await api.post('/api/groups/create', { name: trimmed }, token!);
                        setGroups(prev => [...prev, { id: data.id, name: trimmed }]);
                        setShowCreateGroup(false);
                        setNewGroupName('');
                        setToast({ message: "Group created", type: 'success' });
                      } catch (e: any) {
                        setToast({ message: e.message || "Failed to create group", type: 'error' });
                      } finally {
                        setIsCreatingGroup(false);
                      }
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-60"
                  >
                    {isCreatingGroup ? "Creating..." : "Create Group"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteAccountConfirm && (
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
              <h4 className="text-base font-bold text-zinc-100">Delete account?</h4>
              <p className="mt-2 text-sm text-zinc-400">
                This permanently deletes your account and messages.
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  disabled={isDeletingAccount}
                  onClick={() => setShowDeleteAccountConfirm(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  disabled={isDeletingAccount}
                  onClick={handleDeleteAccount}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {isDeletingAccount ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
