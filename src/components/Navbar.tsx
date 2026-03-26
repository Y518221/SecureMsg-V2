import React, { useState } from 'react';
import { Shield, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NavbarProps {
  setView: (view: any) => void;
  user: any;
}

export const Navbar: React.FC<NavbarProps> = ({ setView, user }) => {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { label: 'Home', view: 'home' },
    { label: 'About', view: 'about' },
  ];

  return (
    <nav className="h-20 border-b border-zinc-800/50 flex items-center justify-between px-6 lg:px-8 bg-[#0d0d0f]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
        <Shield className="w-8 h-8 text-emerald-500" />
        <span className="text-xl font-bold tracking-tight">SecureMsg</span>
      </div>
      
      {/* Desktop Nav */}
      <div className="hidden md:flex items-center gap-8">
        {navLinks.map(link => (
          <button 
            key={link.view}
            onClick={() => setView(link.view as any)} 
            className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            {link.label}
          </button>
        ))}
        {user ? (
          <button 
            onClick={() => setView('chat')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-full text-sm font-bold transition-all"
          >
            Open App
          </button>
        ) : (
          <>
            <button onClick={() => setView('login')} className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors">Login</button>
            <button 
              onClick={() => setView('register')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-full text-sm font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            >
              Get Started
            </button>
          </>
        )}
      </div>

      {/* Mobile Menu Button */}
      <button 
        className="md:hidden p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Nav Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-0 right-0 bg-[#0d0d0f] border-b border-zinc-800 p-6 flex flex-col gap-4 md:hidden shadow-2xl"
          >
            {navLinks.map(link => (
              <button 
                key={link.view}
                onClick={() => {
                  setView(link.view as any);
                  setIsOpen(false);
                }} 
                className="text-left py-2 text-lg font-medium text-zinc-400 hover:text-zinc-100 transition-colors border-b border-zinc-800/50"
              >
                {link.label}
              </button>
            ))}
            {user ? (
              <button 
                onClick={() => {
                  setView('chat');
                  setIsOpen(false);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl text-lg font-bold transition-all"
              >
                Open App
              </button>
            ) : (
              <div className="flex flex-col gap-3 pt-2">
                <button 
                  onClick={() => {
                    setView('login');
                    setIsOpen(false);
                  }}
                  className="w-full bg-zinc-900 text-zinc-100 py-4 rounded-xl text-lg font-bold border border-zinc-800 transition-all"
                >
                  Login
                </button>
                <button 
                  onClick={() => {
                    setView('register');
                    setIsOpen(false);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl text-lg font-bold transition-all"
                >
                  Get Started
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
