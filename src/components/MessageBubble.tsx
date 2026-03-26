import React from 'react';
import { FileText, Lock, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface MessageBubbleProps {
  msg: any;
  isMe: boolean;
  decryptedText?: string;
  onDownload: (content: string) => void;
  onDelete: (id: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ msg, isMe, decryptedText, onDownload, onDelete }) => (
  <div className={cn(
    "flex group relative",
    isMe ? "justify-end" : "justify-start"
  )}>
    <div className={cn(
      "max-w-[85%] sm:max-w-[70%] p-3 sm:p-4 rounded-2xl relative",
      isMe 
        ? "bg-emerald-600 text-white rounded-tr-none shadow-[0_4px_15px_rgba(16,185,129,0.2)]" 
        : "bg-zinc-800 text-zinc-100 rounded-tl-none border border-zinc-700/50"
    )}>
      {isMe && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete(msg.id);
          }}
          className="absolute -left-10 top-1/2 -translate-y-1/2 opacity-60 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity p-2 text-zinc-500 hover:text-red-400 z-10"
          title="Delete message"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
      
      {msg.type === 'file' ? (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-lg">
            <FileText className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate">
              {decryptedText?.includes('|') ? decryptedText.split('|')[0] : "Encrypted File"}
            </p>
            {decryptedText ? (
              <button 
                onClick={() => onDownload(decryptedText)}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold mt-1 flex items-center gap-1"
              >
                Download File
              </button>
            ) : (
              <p className="text-[10px] opacity-40 italic">Locked</p>
            )}
          </div>
        </div>
      ) : decryptedText ? (
        <p className="leading-relaxed text-sm">{decryptedText}</p>
      ) : (
        <div className="flex items-center gap-2 text-zinc-500 italic">
          <Lock className="w-3 h-3" />
          <span className="text-xs">Encrypted Message</span>
        </div>
      )}
      
      <span className="text-[9px] opacity-40 mt-1 block text-right">
        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  </div>
);
