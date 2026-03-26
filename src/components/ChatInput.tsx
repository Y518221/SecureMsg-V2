import React from 'react';
import { Paperclip, Send, Shield } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (val: string) => void;
  onSend: (e: React.FormEvent) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export const ChatInput: React.FC<ChatInputProps> = ({ input, setInput, onSend, onFileUpload, fileInputRef }) => (
  <form onSubmit={onSend} className="flex items-center gap-2 sm:gap-3">
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
      className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
    >
      <Paperclip className="w-5 h-5" />
    </button>
    <div className="flex-1 relative">
      <input 
        id="chat-message"
        name="message"
        type="text" 
        placeholder="Type a message..." 
        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 sm:py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
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
      className="bg-emerald-600 hover:bg-emerald-500 text-white p-2.5 sm:p-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Send className="w-5 h-5" />
    </button>
  </form>
);
