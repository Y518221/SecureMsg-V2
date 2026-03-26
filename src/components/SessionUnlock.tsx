import React from 'react';
import { Key } from 'lucide-react';
import { motion } from 'motion/react';

interface SessionUnlockProps {
  unlockPassword: string;
  setUnlockPassword: (val: string) => void;
  onUnlock: (e: React.FormEvent) => void;
  isUnlocking: boolean;
}

export const SessionUnlock: React.FC<SessionUnlockProps> = ({ unlockPassword, setUnlockPassword, onUnlock, isUnlocking }) => (
  <motion.form 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    onSubmit={onUnlock}
    className="bg-[#0d0d0f] border border-emerald-500/20 rounded-2xl p-4 flex flex-col gap-3 shadow-[0_0_30px_rgba(16,185,129,0.05)]"
  >
    <div className="flex items-center gap-2 text-emerald-500 mb-1">
      <Key className="w-4 h-4" />
      <h4 className="text-xs font-bold uppercase tracking-widest">Unlock Encrypted Session</h4>
    </div>
    <p className="text-[11px] text-zinc-500 leading-relaxed">
      Enter the chat password to derive the session key. This key is stored only in memory and will be discarded when you close the tab or logout.
    </p>
    <div className="flex flex-col sm:flex-row gap-2 mt-1">
      <input 
        id="session-password"
        name="sessionPassword"
        type="password" 
        placeholder="Enter Session Password..." 
        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
        value={unlockPassword}
        onChange={(e) => setUnlockPassword(e.target.value)}
        required
      />
      <button 
        disabled={isUnlocking}
        className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
      >
        {isUnlocking ? 'Unlocking...' : 'Unlock Session'}
      </button>
    </div>
  </motion.form>
);
