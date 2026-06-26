import React, { useState } from 'react';
import { Trophy, Activity, GitBranch, BarChart3, Lock, ShieldAlert, Newspaper } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isConnected: boolean;
  isAdmin: boolean;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isConnected,
  isAdmin,
  onLogout
}) => {
  const [logoError, setLogoError] = useState(false);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'bracket', label: 'Knockout', icon: GitBranch },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
<<<<<<< Updated upstream
    { id: 'fantasy', label: 'Fantasy League', icon: Sparkles },
    { id: 'news', label: 'News & Gallery', icon: Newspaper },
    ...(role === 'superuser' ? [{ id: 'display', label: 'Scoreboard', icon: Monitor }] : []),
    { id: 'admin', label: 'Admin Scorer', icon: Lock },
=======
    { id: 'news', label: 'News', icon: Newspaper },
    { id: 'admin', label: 'Admin', icon: Lock },
>>>>>>> Stashed changes
  ];

  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-slate-800/80 px-3 sm:px-4 py-2.5 sm:py-3 md:px-8">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">

        {/* Logo and Connection Indicator */}
        <div className="flex items-center gap-3">
          {!logoError ? (
            <img
              src="/logo.png"
              alt="Trischel Logo"
              onError={() => setLogoError(true)}
              className="w-10 h-10 object-contain rounded-xl"
            />
          ) : (
            <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 p-2 rounded-xl shadow-lg shadow-emerald-500/10 flex items-center justify-center w-10 h-10 shrink-0">
              <Trophy className="w-5 h-5 text-slate-950 font-bold" />
            </div>
          )}
          <div>
            <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-200 to-violet-400 bg-clip-text text-transparent m-0">
              Trischel Sports Encounter 2026
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                Cricket
              </span>
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 pulse-fast' : 'bg-rose-500'}`} />
                <span className="text-[9px] text-slate-400 font-medium tracking-wider uppercase">
                  {isConnected ? 'Real-time' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-950/40 p-1.5 rounded-xl border border-slate-800/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all duration-300 ${isActive
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border border-transparent'
                  }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Info / Logout */}
        {isAdmin && (
          <div className="flex items-center gap-3 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] text-amber-400 font-semibold tracking-wider uppercase">Admin</span>
            </div>
            <button
              onClick={onLogout}
              className="text-[10px] text-rose-400 hover:text-rose-300 font-bold uppercase transition-colors"
            >
              Logout
            </button>
          </div>
        )}

      </div>
    </header>
  );
};
