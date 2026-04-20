import React from 'react';
import { cn } from '../lib/utils';

interface ChatItemProps {
  active?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: number;
  actionIcon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export const ChatItem: React.FC<ChatItemProps> = ({
  active,
  onClick,
  icon,
  title,
  subtitle,
  badge,
  actionIcon,
  actionLabel,
  onAction
}) => (
  <div
    className={cn(
      "w-full flex items-center gap-2 rounded-xl transition-all group border",
      active ? "bg-emerald-600/10 border border-emerald-500/20" : "hover:bg-white/5 border border-transparent"
    )}
  >
    <button
      onClick={onClick}
      className="min-w-0 flex-1 flex items-center gap-3 p-3 text-left"
    >
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center transition-colors shrink-0",
        active ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700"
      )}>
        {icon}
      </div>
      <div className="flex-1 text-left min-w-0">
        <h4 className={cn("text-sm font-bold truncate", active ? "text-white" : "text-zinc-300")}>{title}</h4>
        {subtitle && <p className="text-[11px] text-zinc-500 truncate">{subtitle}</p>}
      </div>
      {badge && (
        <div className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
          {badge}
        </div>
      )}
    </button>
    {onAction && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAction();
        }}
        aria-label={actionLabel}
        title={actionLabel}
        className="mr-2 p-2 rounded-lg text-zinc-500 opacity-70 hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 focus:opacity-100 transition-all"
      >
        {actionIcon}
      </button>
    )}
  </div>
);
