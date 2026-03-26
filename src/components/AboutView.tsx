import React from 'react';
import { Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { Navbar } from './Navbar';

interface AboutViewProps {
  setView: (view: any) => void;
  user: any;
}

export const AboutView: React.FC<AboutViewProps> = ({ setView, user }) => {
  return (
    <div className="min-h-full bg-[#0a0a0c] flex flex-col">
      <Navbar setView={setView} user={user} />
      
      <main className="flex-1 py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl font-bold mb-8">About SecureMsg</h1>
            
            <div className="space-y-12 text-zinc-400 leading-relaxed">
              <section>
                <h2 className="text-xl font-bold text-zinc-100 mb-4">The Mission</h2>
                <p>
                  SecureMsg was built on a simple premise: privacy is a fundamental human right. In an era of mass surveillance and data breaches, we believe that your personal conversations should remain exactly that - personal.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-zinc-100 mb-4">Zero-Knowledge Architecture</h2>
                <p className="mb-4">
                  Unlike many "secure" messengers that store your keys on their servers, SecureMsg uses a true zero-knowledge model. 
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong className="text-zinc-200">Client-Side Derivation:</strong> Your session keys are derived on your device using PBKDF2 with unique salts.</li>
                  <li><strong className="text-zinc-200">No Key Storage:</strong> We never see, receive, or store your encryption keys or plaintext passwords.</li>
                  <li><strong className="text-zinc-200">Encrypted Blobs:</strong> Our database only stores encrypted data. Even if our servers were compromised, your messages remain unreadable.</li>
                </ul>
              </section>

              <section className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8">
                <h2 className="text-xl font-bold text-zinc-100 mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  Security Specifications
                </h2>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-2">Encryption</h3>
                    <p className="text-sm">AES-256-GCM for authenticated encryption of all messages and files.</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-2">Key Derivation</h3>
                    <p className="text-sm">PBKDF2 with 100,000 iterations and SHA-256 hashing.</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-2">Identity</h3>
                    <p className="text-sm">Anonymous Secure IDs. No email or phone number required.</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-2">Persistence</h3>
                    <p className="text-sm">Session-based keys. Data locks automatically on logout.</p>
                  </div>
                </div>
              </section>

              <div className="pt-8 text-center">
                <button 
                  onClick={() => setView(user ? 'chat' : 'register')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-4 rounded-2xl text-lg font-bold transition-all"
                >
                  Join the Secure Revolution
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};
