import React, { useState } from 'react';
import { Shield, ChevronLeft, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../services/api';

interface AuthViewProps {
  view: string;
  setView: (view: any) => void;
  setToken: (token: string) => void;
  setUser: (user: any) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ view, setView, setToken, setUser }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const endpoint = view === 'login' ? '/api/auth/login' : '/api/auth/register';
    try {
      const data = await api.post(endpoint, { username, password });
      if (data.token) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
      } else if (data.success) {
        setView('login');
      }
    } catch (e: any) {
      setError(e.message || 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col bg-[#0a0a0c]">
      <div className="p-4">
        <button onClick={() => setView('home')} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-200 transition-colors">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Home</span>
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#0d0d0f] border border-zinc-800/50 rounded-3xl p-8 shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4 border border-emerald-500/20">
              <Shield className="w-8 h-8 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">SecureMsg</h1>
            <p className="text-zinc-500 text-sm mt-1">Zero-Knowledge Encrypted Messaging</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Username</label>
              <input 
                id="auth-username"
                name="username"
                type="text" 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Password</label>
              <input 
                id="auth-password"
                name="password"
                type="password" 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2 text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button 
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Processing...' : view === 'login' ? 'Login' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-zinc-500 text-sm mt-6">
            {view === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}
            <button onClick={() => setView(view === 'login' ? 'register' : 'login')} className="text-emerald-500 hover:underline font-medium">
              {view === 'login' ? 'Register' : 'Login'}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
};
