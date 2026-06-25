import React from 'react';
import { getTeamLogo, type Match, type Team } from '../services/pocketbase';
import { Calendar, Trophy, Clock } from 'lucide-react';
import { parseStage, getRoundName } from '../services/bracketUtils';

interface BracketProps {
  matches: Match[];
  teams: Team[];
}

export const Bracket: React.FC<BracketProps> = ({ matches, teams }) => {
  const getTeam = (id: string) => teams.find((t) => t.id === id);

  const formatMatchTime = (timeStr?: string) => {
    if (!timeStr) return '';
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) return timeStr;
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return timeStr;
    }
  };

  // Dynamically calculate rounds
  const totalRounds = matches.length > 0 
    ? Math.max(...matches.map(m => parseStage(m.stage).round), 1) 
    : 1;

  const finalMatch = matches.find(m => m.stage === 'Final');

  // Build round-by-round columns (from leftmost round down to Final)
  const columns = [];
  for (let r = totalRounds; r >= 1; r--) {
    const roundMatches = matches
      .filter(m => parseStage(m.stage).round === r)
      .sort((a, b) => parseStage(a.stage).matchIndex - parseStage(b.stage).matchIndex);
    columns.push({ round: r, matches: roundMatches });
  }

  const renderMatchCard = (match: Match | undefined) => {
    if (!match) {
      return (
        <div className="glass-panel p-4 rounded-xl border border-slate-800 opacity-50 flex items-center justify-center h-28">
          <span className="text-slate-500 text-sm">Match TBD</span>
        </div>
      );
    }

    const team1 = getTeam(match.team1);
    const team2 = getTeam(match.team2);
    const winner = getTeam(match.winner);

    const isLive = match.status === 'Live';
    const isCompleted = match.status === 'Completed';
    // A bye match is completed because it was initialized with only 1 team (no opponent)
    const isByeMatch = isCompleted && match.winner && (!match.team1 || !match.team2);

    return (
      <div 
        className={`glass-panel p-4 rounded-xl border transition-all duration-300 relative overflow-hidden ${
          isLive 
            ? 'neon-glow-emerald border-emerald-500/30' 
            : isCompleted 
              ? 'border-violet-500/20' 
              : 'border-slate-800 hover:border-slate-700'
        }`}
      >
        {/* Pulsing indicator or status badge */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {match.stage}
          </span>
          {isLive && (
            <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-fast" />
              LIVE
            </span>
          )}
          {isCompleted && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold text-violet-400 uppercase tracking-widest bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">
              <Trophy className="w-2.5 h-2.5" />
              {isByeMatch ? 'BYE' : 'End'}
            </span>
          )}
          {!isLive && !isCompleted && (
            <span className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-slate-800/30 px-2 py-0.5 rounded-full">
              <Calendar className="w-2.5 h-2.5" />
              UPCOMING
            </span>
          )}
        </div>

        {match.match_time && !isByeMatch && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold mb-3">
            <Clock className="w-3.5 h-3.5 text-emerald-500/80" />
            <span>{formatMatchTime(match.match_time)}</span>
          </div>
        )}

        {/* Teams section */}
        <div className="space-y-2.5">
          {/* Team 1 */}
          <div className="flex items-center justify-between">
            {match.team1 ? (
              <div className="flex items-center gap-2">
                {team1 && getTeamLogo(team1) ? (
                  <img 
                    src={getTeamLogo(team1)} 
                    alt={team1.short_name}
                    className="w-6 h-6 rounded-md object-cover border border-slate-800"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-md bg-slate-800/80 flex items-center justify-center font-bold text-[10px] text-slate-300 border border-slate-700/50">
                    {team1?.short_name || '?'}
                  </div>
                )}
                <span className={`text-xs font-semibold ${
                  isCompleted && winner?.id !== team1?.id ? 'text-slate-500 line-through' : 'text-slate-200'
                }`}>
                  {team1?.name || 'TBD'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-500 italic text-xs">
                <div className="w-6 h-6 rounded-md bg-slate-900/50 flex items-center justify-center font-bold text-[10px] text-slate-600 border border-slate-850">
                  -
                </div>
                <span>{isByeMatch ? 'BYE' : 'TBD'}</span>
              </div>
            )}
            {isCompleted && winner?.id === team1?.id && (
              <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">WINNER</span>
            )}
          </div>

          {/* Team 2 */}
          <div className="flex items-center justify-between">
            {match.team2 ? (
              <div className="flex items-center gap-2">
                {team2 && getTeamLogo(team2) ? (
                  <img 
                    src={getTeamLogo(team2)} 
                    alt={team2.short_name}
                    className="w-6 h-6 rounded-md object-cover border border-slate-800"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-md bg-slate-800/80 flex items-center justify-center font-bold text-[10px] text-slate-300 border border-slate-700/50">
                    {team2?.short_name || '?'}
                  </div>
                )}
                <span className={`text-xs font-semibold ${
                  isCompleted && winner?.id !== team2?.id ? 'text-slate-500 line-through' : 'text-slate-200'
                }`}>
                  {team2?.name || 'TBD'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-500 italic text-xs">
                <div className="w-6 h-6 rounded-md bg-slate-900/50 flex items-center justify-center font-bold text-[10px] text-slate-600 border border-slate-850">
                  -
                </div>
                <span>{isByeMatch ? 'BYE' : 'TBD'}</span>
              </div>
            )}
            {isCompleted && winner?.id === team2?.id && (
              <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">WINNER</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 overflow-x-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
          Tournament Bracket
        </h2>
        <p className="text-xs text-slate-400 mt-1">Knockout Stage Trees - Road to the Championship</p>
        <p className="text-[10px] text-slate-500 mt-1.5 block md:hidden">Swipe horizontally to view full bracket ↔️</p>
      </div>

      {/* Dynamic Bracket Columns Grid */}
      <div 
        className="grid gap-8 items-stretch justify-center relative py-4"
        style={{ 
          gridTemplateColumns: `repeat(${totalRounds}, minmax(240px, 1fr))`,
          minWidth: `${totalRounds * 260}px`
        }}
      >
        {columns.map((col, colIdx) => {
          const roundName = getRoundName(col.round);
          const isLastCol = colIdx === columns.length - 1;
          const isFirstCol = colIdx === 0;

          return (
            <div key={col.round} className="flex flex-col justify-around gap-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 text-center mb-2">
                {roundName}
              </h3>
              {col.matches.map((m, idx) => (
                <div key={m?.id || idx} className="relative group">
                  {/* Left connector to previous round matches */}
                  {!isFirstCol && (
                    <div className="hidden md:block absolute top-1/2 -left-8 w-8 h-[1px] bg-slate-800" />
                  )}
                  {renderMatchCard(m)}
                  {/* Right connector to next round match */}
                  {!isLastCol && (
                    <div className="hidden md:block absolute top-1/2 -right-8 w-8 h-[1px] bg-slate-800 group-hover:bg-emerald-500/30 transition-colors" />
                  )}
                </div>
              ))}
              
              {/* Champion box below Final if winner decided */}
              {col.round === 1 && finalMatch && finalMatch.status === 'Completed' && finalMatch.winner && (
                <div className="mt-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-center flex flex-col items-center justify-center animate-bounce shadow-lg shadow-amber-500/5 max-w-[240px] mx-auto">
                  <Trophy className="w-8 h-8 text-amber-400 mb-1" />
                  <span className="text-[10px] font-bold text-amber-400 tracking-widest uppercase">CHAMPIONS</span>
                  <span className="text-sm font-extrabold text-slate-100 mt-1">
                    {getTeam(finalMatch.winner)?.name}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
