import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ToastProps {
  toast: { message: string, type: 'error' | 'success' } | null;
}

export const Toast: React.FC<ToastProps> = ({ toast }) => (
  <AnimatePresence>
    {toast && (
      <motion.div 
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
          toast.type === 'success' 
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-400' 
            : 'bg-red-950/90 border-red-500/50 text-red-400'
        } backdrop-blur-xl`}
      >
        {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
        <span className="text-sm font-medium">{toast.message}</span>
      </motion.div>
    )}
  </AnimatePresence>
);
