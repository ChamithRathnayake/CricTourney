import React from 'react';
import { getTeamLogo, type Team } from '../services/pocketbase';
import { Trophy, Users, Flame, Sparkles, Swords, Activity } from 'lucide-react';

interface PreTournamentTeaserProps {
  tab: string;
  teams: Team[];
}

export const PreTournamentTeaser: React.FC<PreTournamentTeaserProps> = ({ tab, teams }) => {
  const teamCount = teams.length;

  const getTeaserDescription = () => {
    if (teamCount > 0) {
      return `The ultimate clash for corporate glory. ${teamCount} ${teamCount === 1 ? 'team' : 'teams'} competing, 1 coveted trophy. Squad rosters are locking in, and the pitch is being prepped for the first delivery.`;
    } else {
      return 'The ultimate clash for corporate glory. 1 coveted trophy. Squad rosters are locking in, and the pitch is being prepped for the first delivery.';
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8 animate-fade-in">
      
      {/* Hype Hero Banner */}
      <div className="relative glass-panel rounded-3xl border border-slate-800/80 p-8 text-center overflow-hidden bg-gradient-to-br from-slate-900/60 via-slate-950/40 to-slate-900/60 shadow-2xl">
        <div className="absolute -right-32 -top-32 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-32 -bottom-32 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Company Logo */}
        <div className="flex justify-center mb-6">
          <img 
            src="/logo.png" 
            alt="Trischel Logo" 
            className="h-16 w-auto object-contain drop-shadow-[0_0_15px_rgba(52,211,153,0.15)]"
          />
        </div>

        <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-emerald-400 via-teal-200 to-emerald-400 bg-clip-text text-transparent uppercase tracking-tight leading-none mb-3">
          Trischel sports encounter - 2026
        </h1>

        {/* Cricket Highlight Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Cricket Tournament</span>
        </div>

        <p className="text-sm text-slate-350 max-w-xl mx-auto font-medium leading-relaxed">
          {getTeaserDescription()}
        </p>
      </div>

      {/* Tab Specific Content */}
      {tab === 'dashboard' && (
        <div className="space-y-8">
          {/* Main Teaser card */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-905/30">
            <div className="space-y-3 max-w-md text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg text-xs font-bold border border-amber-500/20">
                <Activity className="w-4 h-4 animate-pulse" />
                <span>Status: Preparing Arena</span>
              </div>
              <h3 className="text-lg font-black text-slate-200 uppercase tracking-tight">Match Schedules Pending</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                Admin is currently configuring match times and designing the bracket slots. As soon as the first matchup starts, live score updates, commentaries, and overs progress will stream here in real-time.
              </p>
            </div>
            
            <div className="flex flex-col items-center justify-center p-6 bg-slate-950/60 border border-slate-850 rounded-2xl min-w-[200px] text-center shrink-0">
              <Trophy className="w-10 h-10 text-emerald-450 drop-shadow-[0_0_8px_rgba(52,211,153,0.2)] mb-2.5" />
              <div className="text-base font-black text-slate-100 uppercase tracking-wider">Trischel Cup 2026</div>
              <span className="text-[10px] text-slate-550 font-bold uppercase mt-1">First Ball Commencing Soon</span>
            </div>
          </div>

          {/* Participating Teams Gallery */}
          {teams.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b border-slate-900 pb-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                Participating Teams ({teams.length})
              </h4>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {teams.map(t => (
                  <div key={t.id} className="glass-panel p-4 rounded-2xl border border-slate-900/60 bg-slate-900/20 hover:border-slate-800/80 hover:bg-slate-950/40 transition-all duration-300 group text-center flex flex-col items-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-850 flex items-center justify-center overflow-hidden mb-3 group-hover:scale-105 transition-all duration-300 shadow-md">
                      {getTeamLogo(t) ? (
                        <img src={getTeamLogo(t)} className="w-full h-full object-cover" alt={t.name} />
                      ) : (
                        <span className="text-sm font-black text-slate-400">{t.short_name}</span>
                      )}
                    </div>
                    <div className="text-xs font-extrabold text-slate-250 group-hover:text-emerald-400 transition-colors leading-tight">{t.name}</div>
                    <span className="text-[9px] text-slate-500 font-extrabold uppercase mt-1 tracking-wider">{t.short_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'bracket' && (
        <div className="space-y-6">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800/80 space-y-4 bg-slate-905/30 text-center">
            <Swords className="w-10 h-10 text-emerald-400 mx-auto drop-shadow-[0_0_8px_rgba(52,211,153,0.2)]" />
            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-slate-200 uppercase tracking-tight">Knockout Bracket Draw Loading</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed font-medium">
                The tournament will follow a single-elimination knockout format starting from the Quarter-Finals. The match pairings are currently being designed.
              </p>
            </div>
          </div>

          {/* Bracket preview mock */}
          <div className="relative glass-panel rounded-3xl border border-slate-900/60 p-6 overflow-hidden bg-slate-950/20 opacity-60 select-none">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/50 to-slate-950/80 flex items-center justify-center z-10">
              <div className="text-center bg-slate-950/90 border border-slate-805 px-5 py-3 rounded-2xl shadow-xl backdrop-blur-sm">
                <span className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">Draw Status</span>
                <div className="text-xs font-bold text-slate-250 mt-1">Committee finalizing matchups</div>
              </div>
            </div>

            {/* Simple visual mock of QF bracket layout */}
            <div className="grid grid-cols-3 gap-6 max-w-xl mx-auto text-[10px] font-bold">
              <div className="space-y-8 py-4">
                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl space-y-1.5">
                  <div className="text-slate-500">QF1 - Team A</div>
                  <div className="text-slate-500">QF1 - Team B</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl space-y-1.5">
                  <div className="text-slate-500">QF2 - Team C</div>
                  <div className="text-slate-500">QF2 - Team D</div>
                </div>
              </div>
              <div className="flex flex-col justify-center py-4">
                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl space-y-1.5">
                  <div className="text-slate-500">SF1 - Winner QF1</div>
                  <div className="text-slate-500">SF1 - Winner QF2</div>
                </div>
              </div>
              <div className="flex flex-col justify-center py-4">
                <div className="bg-slate-900 border border-slate-800/80 p-3.5 rounded-2xl border-dashed border-emerald-500/20 text-center">
                  <Trophy className="w-5 h-5 text-slate-650 mx-auto mb-1" />
                  <span className="text-slate-500 block">CHAMPIONS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <div className="space-y-6">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800/80 space-y-4 bg-slate-905/30 text-center">
            <Flame className="w-10 h-10 text-emerald-450 mx-auto drop-shadow-[0_0_8px_rgba(52,211,153,0.25)] animate-pulse" />
            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-slate-200 uppercase tracking-tight">Leaderboards Standby</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed font-medium">
                The battle for individual caps and tournament awards. Stat trackers will activate instantly as runs, wickets, dot balls, and maidens are scored.
              </p>
            </div>
          </div>

          {/* Caps Teaser cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-slate-900/60 bg-slate-950/20 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Trophy className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-250 uppercase tracking-wider">Orange Cap</h4>
                <p className="text-[10px] text-slate-400 mt-1">Awarded to the batsman with the most runs scored. Track strike rates, fours, and sixes in real-time.</p>
              </div>
            </div>
            
            <div className="glass-panel p-5 rounded-2xl border border-slate-900/60 bg-slate-950/20 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                <Flame className="w-6 h-6 text-violet-500" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-250 uppercase tracking-wider">Purple Cap</h4>
                <p className="text-[10px] text-slate-400 mt-1">Awarded to the bowler with the most wickets taken. Track economy rate and bowler stats.</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
