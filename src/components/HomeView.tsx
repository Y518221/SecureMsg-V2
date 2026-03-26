import React from 'react';
import { Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { Navbar } from './Navbar';

interface HomeViewProps {
  setView: (view: any) => void;
  user: any;
}

export const HomeView: React.FC<HomeViewProps> = ({ setView, user }) => {
  return (
    <div className="min-h-full bg-[#0a0a0c] flex flex-col">
      <Navbar setView={setView} user={user} />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-24 px-6">
          <div className="max-w-6xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-8">
                <Shield className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-500">End-to-End Encrypted</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
                Your Privacy is <br />
                <span className="text-emerald-500">Non-Negotiable.</span>
              </h1>
              <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed">
                SecureMsg is a zero-knowledge messaging platform where only you and your recipients hold the keys. No backdoors, no tracking, just pure security.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button 
                  onClick={() => setView(user ? 'chat' : 'register')}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-4 rounded-2xl text-lg font-bold transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                >
                  Start Secure Chat
                </button>
                <button 
                  onClick={() => setView('about')}
                  className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 text-zinc-100 px-10 py-4 rounded-2xl text-lg font-bold border border-zinc-800 transition-all"
                >
                  How it Works
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24 bg-[#0d0d0f] border-y border-zinc-800/50 px-6">
          <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Shield className="w-6 h-6 text-emerald-500" />}
              title="AES-256 Encryption"
              description="Every message and file is encrypted client-side using military-grade AES-256 before it ever leaves your device."
            />
            <FeatureCard 
              icon={<Shield className="w-6 h-6 text-emerald-500" />}
              title="Zero-Knowledge"
              description="We never store your passwords or keys. Our servers only see encrypted blobs that are impossible to decrypt without your session key."
            />
            <FeatureCard 
              icon={<Shield className="w-6 h-6 text-emerald-500" />}
              title="Temporary Sessions"
              description="Encryption keys are derived per-session and discarded immediately when you log out or close the connection."
            />
          </div>
        </section>
      </main>

      <footer className="py-12 border-t border-zinc-800/50 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-500" />
            <span className="font-bold">SecureMsg</span>
          </div>
          <p className="text-zinc-500 text-sm">(c) 2026 SecureMsg. All rights reserved. Built for privacy.</p>
          <div className="flex gap-6">
            <button onClick={() => setView('about')} className="text-zinc-500 hover:text-zinc-300 text-sm">Privacy Policy</button>
            <button onClick={() => setView('about')} className="text-zinc-500 hover:text-zinc-300 text-sm">Terms of Service</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-zinc-900/30 border border-zinc-800/50 p-8 rounded-3xl hover:border-emerald-500/30 transition-all group">
      <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6 group-hover:bg-emerald-500/10 transition-colors">
        {icon}
      </div>
      <h3 className="text-lg font-bold mb-3">{title}</h3>
      <p className="text-zinc-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
