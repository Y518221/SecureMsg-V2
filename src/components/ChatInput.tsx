import React from 'react';
import { Paperclip, Send, Shield } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (val: string) => void;
  onSend: (e: React.FormEvent) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export const ChatInput: React.FC<ChatInputProps> = ({ input, setInput, onSend, onFileUpload, fileInputRef }) => (
  <form onSubmit={onSend} className="flex w-full min-w-0 items-center gap-2 sm:gap-3">
    <input 
      id="chat-file"
      name="attachment"
      type="file" 
      className="hidden" 
      ref={fileInputRef} 
      onChange={onFileUpload}
    />
    <button 
      type="button" 
      onClick={() => fileInputRef.current?.click()}
      className="shrink-0 p-2 text-zinc-500 transition-colors hover:text-zinc-300"
    >
      <Paperclip className="w-5 h-5" />
    </button>
    <div className="relative min-w-0 flex-1">
      <input 
        id="chat-message"
        name="message"
        type="text" 
        placeholder="Type a message..." 
        className="w-full min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm transition-colors focus:border-emerald-500/50 focus:outline-none sm:py-3"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-2">
        <Shield className="w-4 h-4 text-emerald-500/30" />
      </div>
    </div>
    <button 
      type="submit"
      disabled={!input.trim()}
      className="shrink-0 rounded-xl bg-emerald-600 p-2.5 text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:p-3"
    >
      <Send className="w-5 h-5" />
    </button>
  </form>
);
