import React, { useState } from 'react';
import { pb } from '../services/pocketbase';
import { ShieldCheck, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // 1. Try superuser login (PocketBase v0.39+ '_superusers')
      await pb.collection('_superusers').authWithPassword(email, password);
      onLoginSuccess();
      return;
    } catch (err: any) {
      // 2. Try older PocketBase admin login
      try {
        await pb.admins.authWithPassword(email, password);
        onLoginSuccess();
        return;
      } catch (fallbackErr: any) {
        // 3. Try standard users collection (for Scorer / News Manager roles)
        try {
          await pb.collection('users').authWithPassword(email, password);
          onLoginSuccess();
          return;
        } catch (userErr: any) {
          setError(userErr?.message || 'Invalid credentials. Please try again.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-md glass-panel p-8 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden">
        
        {/* Decorative ambient background glows */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl" />

        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 p-3.5 rounded-2xl shadow-xl shadow-emerald-500/15 mb-4">
            <ShieldCheck className="w-8 h-8 text-slate-950" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 m-0">Scorer Portal</h2>
          <p className="text-sm text-slate-400 mt-1">Authenticate to update live tournament scores</p>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3.5 rounded-xl text-xs mb-6 relative z-10">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5 relative z-10">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="scorer@crictourney.online"
                required
                className="w-full pl-11 pr-4 py-3 bg-slate-950/60 border border-slate-800/80 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition-all duration-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full pl-11 pr-4 py-3 bg-slate-950/60 border border-slate-800/80 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition-all duration-300"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-sm rounded-xl cursor-pointer hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-all duration-300"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Authenticating Scorer...</span>
              </>
            ) : (
              <span>Sign In as Admin</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
