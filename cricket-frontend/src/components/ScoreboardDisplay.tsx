import React, { useState, useEffect } from 'react';
import { pb, getTeamLogo, getFileUrl } from '../services/pocketbase';
import type { Match, Team, Player, Inning, Delivery, TournamentConfig, MatchVote } from '../services/pocketbase';
import { Activity, Loader2, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseStage } from '../services/bracketUtils';

interface ScoreboardDisplayProps {
  matches: Match[];
  teams: Team[];
  players: Player[];
  tournamentConfig: TournamentConfig | null;
}

export const ScoreboardDisplay: React.FC<ScoreboardDisplayProps> = ({
  matches,
  teams,
  players,
  tournamentConfig
}) => {
  const [logoError, setLogoError] = useState(false);
  const [allInnings, setAllInnings] = useState<Inning[]>([]);
  const [allDeliveries, setAllDeliveries] = useState<Delivery[]>([]);
  const [votes, setVotes] = useState<MatchVote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [prevDeliveryId, setPrevDeliveryId] = useState<string>('');
  const [showHighlight, setShowHighlight] = useState<'Wicket' | 'Four' | 'Six' | null>(null);

  // Find the active live match
  const liveMatch = matches.find(m => m.status === 'Live');
  
  // Find final match and check if tournament has ended
  const finalMatch = matches.find(m => m.stage === 'Final');
  const isTournamentEnded = finalMatch?.status === 'Completed';
  const championTeam = finalMatch ? teams.find(t => t.id === finalMatch.winner) : null;

  const [localPhase, setLocalPhase] = useState<'All' | 'Quarter Finals' | 'Semi Finals'>(() => {
    return (localStorage.getItem('stats_from_phase') as any) || 'All';
  });

  useEffect(() => {
    const handleStorage = () => {
      const stored = localStorage.getItem('stats_from_phase');
      if (stored) setLocalPhase(stored as any);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const phaseSetting = tournamentConfig?.stats_from_phase || localPhase || 'All';

  // Filter deliveries by tournament phase setting for accolade calculations
  const filteredDeliveries = React.useMemo(() => {
    if (phaseSetting === 'All') return allDeliveries;

    const inningMap = new Map(allInnings.map(i => [i.id, i.match]));

    return allDeliveries.filter(d => {
      const matchId = inningMap.get(d.inning);
      const match = matches.find(m => m.id === matchId);
      if (!match) return true;

      const parsed = parseStage(match.stage);
      if (phaseSetting === 'Quarter Finals') {
        return parsed.round <= 3; // QF, SF, Final
      }
      if (phaseSetting === 'Semi Finals') {
        return parsed.round <= 2; // SF, Final
      }
      return true;
    });
  }, [allDeliveries, allInnings, phaseSetting, matches]);

  const fetchDisplayData = async () => {
    try {
      const inningsList = await pb.collection('innings').getFullList<Inning>({
        sort: '+created',
        requestKey: null
      });
      setAllInnings(inningsList);

      const deliveriesList = await pb.collection('deliveries').getFullList<Delivery>({
        sort: '+created',
        expand: 'striker,bawler,out_player,fielder',
        requestKey: null
      });
      setAllDeliveries(deliveriesList);

      const votesList = await pb.collection('match_votes').getFullList<MatchVote>({
        requestKey: null
      });
      setVotes(votesList);
    } catch (err) {
      console.error('Error fetching scoreboard display data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDisplayData();

    // Subscribe to innings, deliveries, and tournament_config for real-time updates
    pb.collection('innings').subscribe('*', () => fetchDisplayData());
    pb.collection('deliveries').subscribe('*', () => fetchDisplayData());
    pb.collection('match_votes').subscribe('*', () => fetchDisplayData());
    pb.collection('tournament_config').subscribe('*', () => fetchDisplayData());

    // Fallback polling interval (4s) for LED Scoreboard Display in case Cloudflare drops SSE
    const pollInterval = setInterval(() => {
      fetchDisplayData();
    }, 4000);

    return () => {
      clearInterval(pollInterval);
      pb.collection('innings').unsubscribe('*');
      pb.collection('deliveries').unsubscribe('*');
      pb.collection('match_votes').unsubscribe('*');
      pb.collection('tournament_config').unsubscribe('*');
    };
  }, []);

  useEffect(() => {
    if (liveMatch && allDeliveries.length > 0) {
      const matchInnings = allInnings.filter(i => i.match === liveMatch.id);
      const activeInning = matchInnings[matchInnings.length - 1];
      if (activeInning) {
        const inningDeliveries = allDeliveries.filter(d => d.inning === activeInning.id);
        if (inningDeliveries.length > 0) {
          const lastDel = inningDeliveries[inningDeliveries.length - 1];
          if (prevDeliveryId && lastDel.id !== prevDeliveryId) {
            if (lastDel.is_wicket && lastDel.dismissal_type !== 'Retired Out') {
              setShowHighlight('Wicket');
            } else if (lastDel.runs_off_bat === 4) {
              setShowHighlight('Four');
            } else if (lastDel.runs_off_bat === 6) {
              setShowHighlight('Six');
            }
          }
          setPrevDeliveryId(lastDel.id);
        }
      }
    }
  }, [allDeliveries, allInnings, liveMatch, prevDeliveryId]);

  useEffect(() => {
    if (showHighlight) {
      const timer = setTimeout(() => {
        setShowHighlight(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [showHighlight]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-slate-100">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
        <span className="text-sm font-semibold tracking-widest text-slate-400 uppercase mt-4">
          Loading Scoreboard Feed...
        </span>
      </div>
    );
  }

  // helper to get a team object by ID
  const getTeam = (teamId: string) => teams.find(t => t.id === teamId);
  const getPlayer = (playerId: string) => players.find(p => p.id === playerId);

  // Live Scoreboard Data calculations
  const renderLiveScoreboard = () => {
    if (!liveMatch) return null;

    const matchInnings = allInnings.filter(i => i.match === liveMatch.id);
    
    const activeInning = matchInnings[matchInnings.length - 1];
    const isSecondInning = matchInnings.length >= 2 && matchInnings.length % 2 === 0;

    if (!activeInning) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Activity className="w-16 h-16 text-emerald-400/30 animate-pulse mb-4" />
          <h2 className="text-xl font-bold text-slate-200">Match is Live</h2>
          <p className="text-sm text-slate-500 mt-2">Waiting for the scorer to start the first inning...</p>
        </div>
      );
    }

    const battingTeam = getTeam(activeInning.batting_team);
    const bowlingTeam = getTeam(activeInning.bawling_team);
    
    const inningDeliveries = allDeliveries.filter(d => d.inning === activeInning.id);
    
    // Active batsman and bowlers
    let currentStrikerId = '';
    let currentNonStrikerId = '';
    let currentBowlerId = '';

    if (inningDeliveries.length > 0) {
      const lastDel = inningDeliveries[inningDeliveries.length - 1];
      currentStrikerId = lastDel.striker;
      currentBowlerId = lastDel.bawler;
      
      // Attempt to determine the non-striker
      const uniqueBatsmen = Array.from(new Set(inningDeliveries.map(d => d.striker)));
      const dismissedIds = Array.from(new Set(inningDeliveries.filter(d => d.is_wicket && d.out_player).map(d => d.out_player)));
      const activeBatsmen = uniqueBatsmen.filter(id => !dismissedIds.includes(id));
      
      const otherBatsman = activeBatsmen.find(id => id !== currentStrikerId);
      if (otherBatsman) {
        currentNonStrikerId = otherBatsman;
      }

      // Rotate striker if over has finished (ball_number === 6)
      const overFinished = lastDel.ball_number === 6;
      if (overFinished && currentStrikerId && currentNonStrikerId && !lastDel.is_wicket) {
        const isSpecialExtras = liveMatch.special_extras || false;
        const baseExtra = lastDel.extra_type === 'Wide' ? (isSpecialExtras ? 4 : 1) : (isSpecialExtras ? 6 : 1);
        const runsRun = lastDel.runs_off_bat !== undefined && lastDel.runs_off_bat !== null
          ? lastDel.runs_off_bat
          : (lastDel.extra_type === 'Wide' || lastDel.extra_type === 'No Ball' 
            ? Math.max(0, lastDel.runs - baseExtra) 
            : lastDel.runs);
        const didCross = runsRun % 2 !== 0;
        if (!didCross) {
          const temp = currentStrikerId;
          currentStrikerId = currentNonStrikerId;
          currentNonStrikerId = temp;
        }
      }
    }

    // Calculate individual stats for current active striker and non-striker
    const getBatsmanStats = (playerId: string) => {
      const batsmanRuns = inningDeliveries
        .filter(d => d.striker === playerId && d.extra_type !== 'Wide')
        .reduce((sum, d) => {
          const runOffBat = d.runs_off_bat !== undefined && d.runs_off_bat !== null
            ? d.runs_off_bat
            : (d.extra_type === 'No Ball' ? (liveMatch.special_extras ? Math.max(0, (d.runs || 0) - 6) : Math.max(0, (d.runs || 0) - 1)) : (d.runs || 0));
          return sum + runOffBat;
        }, 0);

      const batsmanBalls = inningDeliveries
        .filter(d => d.striker === playerId && d.extra_type !== 'Wide')
        .length;

      const fours = inningDeliveries
        .filter(d => d.striker === playerId && d.extra_type !== 'Wide' && d.runs_off_bat === 4)
        .length;

      const sixes = inningDeliveries
        .filter(d => d.striker === playerId && d.extra_type !== 'Wide' && d.runs_off_bat === 6)
        .length;

      return { runs: batsmanRuns, balls: batsmanBalls, fours, sixes };
    };

    // Calculate bowler stats for the current bowler
    const getBowlerStats = (playerId: string) => {
      const bowlerDeliveries = inningDeliveries.filter(d => d.bawler === playerId);
      
      const isSpecialExtras = liveMatch.special_extras || false;
      const legalBalls = bowlerDeliveries.filter(d => {
        if (d.dismissal_type === 'Retired Out') return false;
        const isWide = d.extra_type === 'Wide';
        const isNoBall = d.extra_type === 'No Ball';
        return isSpecialExtras ? (d.ball_number > 0) : (!isWide && !isNoBall);
      }).length;

      const oversStr = `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;

      const runsConceded = bowlerDeliveries
        .filter(d => d.extra_type !== 'Bye' && d.extra_type !== 'Leg Bye')
        .reduce((sum, d) => sum + (d.runs || 0), 0);

      const wickets = bowlerDeliveries
        .filter(d => d.is_wicket && d.dismissal_type !== 'Run Out' && d.dismissal_type !== 'Retired Out' && d.dismissal_type !== 'None')
        .length;

      return { overs: oversStr, runs: runsConceded, wickets };
    };

    const strikerStats = currentStrikerId ? getBatsmanStats(currentStrikerId) : null;
    const nonStrikerStats = currentNonStrikerId ? getBatsmanStats(currentNonStrikerId) : null;
    const bowlerStats = currentBowlerId ? getBowlerStats(currentBowlerId) : null;

    const striker = currentStrikerId ? getPlayer(currentStrikerId) : null;
    const nonStriker = currentNonStrikerId ? getPlayer(currentNonStrikerId) : null;
    const bowler = currentBowlerId ? getPlayer(currentBowlerId) : null;

    // Calculate target and balls remaining
    const isSuperOver = matchInnings.length > 2;
    const oversLimit = isSuperOver ? 1 : (liveMatch.overs_limit || 5);
    const totalBallsLimit = oversLimit * 6;

    const activeInningRuns = inningDeliveries.reduce((sum, d) => sum + (d.runs || 0), 0);
    const activeInningWickets = inningDeliveries.filter(d => d.is_wicket).length;

    let target = 0;
    let firstInningRuns = 0;
    if (isSecondInning) {
      const firstInningOfPair = matchInnings[matchInnings.length - 2];
      const firstInningOfPairDeliveries = firstInningOfPair 
        ? allDeliveries.filter(d => d.inning === firstInningOfPair.id)
        : [];
      firstInningRuns = firstInningOfPairDeliveries.reduce((sum, d) => sum + (d.runs || 0), 0);
      target = firstInningRuns + 1;
    }

    // Active Inning legal balls count
    const activeLegalBalls = inningDeliveries.filter(d => {
      if (d.dismissal_type === 'Retired Out') return false;
      const isWide = d.extra_type === 'Wide';
      const isNoBall = d.extra_type === 'No Ball';
      return liveMatch.special_extras ? (d.ball_number > 0) : (!isWide && !isNoBall);
    }).length;

    const activeOversStr = `${Math.floor(activeLegalBalls / 6)}.${activeLegalBalls % 6}`;
    const ballsRemaining = Math.max(0, totalBallsLimit - activeLegalBalls);
    const runsNeeded = Math.max(0, target - activeInningRuns);

    // CRR and RRR
    const crr = activeLegalBalls > 0 ? ((activeInningRuns / activeLegalBalls) * 6).toFixed(2) : '0.00';
    const rrr = ballsRemaining > 0 ? ((runsNeeded / ballsRemaining) * 6).toFixed(2) : '0.00';

    const t1 = getTeam(liveMatch.team1);
    const t2 = getTeam(liveMatch.team2);
    const isVotingLocked = isSecondInning && activeLegalBalls >= (liveMatch.overs_limit || 5) * 3;

    const matchVotes = votes.filter(v => v.match === liveMatch.id);
    const votesT1 = matchVotes.filter(v => v.team === liveMatch.team1).length;
    const votesT2 = matchVotes.filter(v => v.team === liveMatch.team2).length;
    const totalVotes = votesT1 + votesT2;
    const pctT1 = totalVotes === 0 ? 50 : Math.round((votesT1 / totalVotes) * 100);
    const pctT2 = totalVotes === 0 ? 50 : 100 - pctT1;

    // Format over summary (Recent over balls)
    const renderRecentBalls = () => {
      const last12 = inningDeliveries.slice(-12);
      if (last12.length === 0) {
        return <div className="text-slate-500 text-xs py-2">Inning just starting...</div>;
      }
      return (
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {last12.map((d, i) => {
            let label = d.runs.toString();
            let bgClass = 'bg-slate-800 border-slate-700 text-slate-300';
            
            if (d.is_wicket) {
              label = 'W';
              bgClass = 'bg-rose-500/20 border-rose-500/40 text-rose-400 font-black';
            } else if (d.extra_type === 'Wide') {
              label = `${d.runs}Wd`;
              bgClass = 'bg-amber-500/20 border-amber-500/30 text-amber-400 font-bold';
            } else if (d.extra_type === 'No Ball') {
              label = `${d.runs}Nb`;
              bgClass = 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300 font-bold';
            } else if (d.runs === 4) {
              bgClass = 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 font-extrabold';
            } else if (d.runs === 6) {
              bgClass = 'bg-teal-500/20 border-teal-500/40 text-teal-300 font-black';
            } else if (d.runs === 0) {
              label = '•';
              bgClass = 'bg-slate-900 border-slate-850 text-slate-500';
            }

            return (
              <span 
                key={d.id || i} 
                className={`w-9 h-9 flex items-center justify-center border text-sm rounded-xl shrink-0 ${bgClass}`}
              >
                {label}
              </span>
            );
          })}
        </div>
      );
    };

    // Last completed over info (Request 3 support)
    const getLastCompletedOverRuns = () => {
      if (activeLegalBalls < 6) return null;
      const lastCompletedOverNum = Math.floor(activeLegalBalls / 6) - 1;
      if (lastCompletedOverNum < 0) return null;

      const overDels = inningDeliveries.filter(d => {
        // Find deliveries that belong to this over number
        // (Note: over_number is 0-indexed in database)
        return d.over_number === lastCompletedOverNum;
      });

      const runsScored = overDels.reduce((sum, d) => sum + (d.runs || 0), 0);
      return { overNum: lastCompletedOverNum + 1, runs: runsScored };
    };

    const lastOverInfo = getLastCompletedOverRuns();

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[72vh] content-stretch">
        
        {/* Left Column: Batting Team Score & Status */}
        <div className="lg:col-span-2 glass-panel p-4.5 rounded-3xl border border-slate-800/80 flex flex-col justify-between relative overflow-hidden bg-slate-950/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
          
          {/* Highlight ball overlay */}
          <AnimatePresence>
            {showHighlight && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-slate-950/90 backdrop-blur-md z-50 rounded-3xl overflow-hidden"
              >
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1.5, opacity: [0.1, 0.25, 0.1] }}
                  transition={{ repeat: Infinity, duration: 2.5 }}
                  className="absolute w-80 h-80 rounded-full border border-white/10 pointer-events-none"
                />

                <motion.div
                  initial={{ scale: 0.8, y: 30, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.8, y: -30, opacity: 0 }}
                  transition={{ type: 'spring', damping: 15 }}
                  className={`relative p-6 rounded-3xl text-center shadow-2xl max-w-xs w-full mx-4 overflow-hidden border ${
                    showHighlight === 'Wicket' 
                      ? 'bg-gradient-to-b from-red-650/90 via-rose-950/95 to-red-950/90 border-red-500/40 shadow-red-500/20' 
                      : showHighlight === 'Four' 
                      ? 'bg-gradient-to-b from-emerald-650/90 via-teal-950/95 to-emerald-950/90 border-emerald-500/40 shadow-emerald-500/20' 
                      : 'bg-gradient-to-b from-indigo-650/90 via-violet-950/95 to-purple-950/90 border-violet-500/40 shadow-violet-500/20'
                  }`}
                >
                  <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                  
                  <motion.div 
                    animate={{ rotate: [0, -10, 10, -10, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-5xl mb-3"
                  >
                    {showHighlight === 'Wicket' ? '☝️' : showHighlight === 'Four' ? '🔥' : '🚀'}
                  </motion.div>
                  
                  <h2 className={`text-5xl font-black tracking-widest uppercase drop-shadow-lg ${
                    showHighlight === 'Wicket' ? 'text-rose-400' : showHighlight === 'Four' ? 'text-emerald-400' : 'text-violet-400'
                  }`}>
                    {showHighlight === 'Wicket' ? 'OUT!' : showHighlight === 'Four' ? 'FOUR!' : 'SIX!'}
                  </h2>
                  
                  <p className="text-slate-350 text-[10px] font-black uppercase tracking-widest mt-1">
                    {showHighlight === 'Wicket' ? 'WICKET FALLEN' : showHighlight === 'Four' ? 'CRACKING BOUNDARY' : 'MASSIVE HIT'}
                  </p>
                  {showHighlight !== 'Wicket' && (() => {
                    const isSix = showHighlight === 'Six';
                    const targetRuns = isSix ? 6 : 4;
                    
                    const inningBattingTeamMap = new Map<string, string>();
                    allInnings.forEach(i => {
                      inningBattingTeamMap.set(i.id, i.batting_team);
                    });
                    
                    let battingTeamName = 'Team';
                    let activeTeamId = '';
                    if (liveMatch) {
                      const matchInnings = allInnings.filter(i => i.match === liveMatch.id);
                      const activeInning = matchInnings[matchInnings.length - 1];
                      if (activeInning) {
                        activeTeamId = activeInning.batting_team;
                        const teamObj = teams.find(t => t.id === activeTeamId);
                        if (teamObj) battingTeamName = teamObj.name;
                      }
                    }
                    
                    const tournamentCount = allDeliveries.filter(d => d.runs_off_bat === targetRuns).length;
                    const teamCount = activeTeamId 
                      ? allDeliveries.filter(d => inningBattingTeamMap.get(d.inning) === activeTeamId && d.runs_off_bat === targetRuns).length 
                      : 0;

                    return (
                      <div className="mt-4 pt-3.5 border-t border-white/10 w-full text-center space-y-2 mx-auto">
                        <div className="flex items-center justify-between text-xs uppercase font-extrabold tracking-wider">
                          <span className="text-slate-400">Tournament Total {isSix ? 'Sixes' : 'Fours'}:</span>
                          <span className={`text-base font-black ${isSix ? 'text-violet-400' : 'text-emerald-400'}`}>
                            {tournamentCount}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs uppercase font-extrabold tracking-wider">
                          <span className="text-slate-400 truncate max-w-[180px]">{battingTeamName} Total:</span>
                          <span className={`text-base font-black ${isSix ? 'text-violet-400' : 'text-emerald-400'}`}>
                            {teamCount}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
            <div className="flex flex-wrap items-center gap-3 sm:gap-5">
              {/* Batting Team */}
              <div className="flex items-center gap-2">
                <img 
                  src={getTeamLogo(battingTeam)} 
                  alt={battingTeam?.name} 
                  className="w-9 h-9 object-contain"
                />
                <div>
                  <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                    {isSuperOver 
                      ? `Super Over ${Math.floor((matchInnings.length - 1) / 2) + 1} - Inn ${matchInnings.length % 2 === 1 ? '01' : '02'}`
                      : `Batting Inning ${isSecondInning ? '02' : '01'}`}
                  </span>
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-100 tracking-tight mt-0.5">{battingTeam?.name}</h2>
                </div>
              </div>

              {/* VS Divider */}
              <div className="px-2 py-0.5 bg-slate-900/60 border border-slate-800 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-widest">
                VS
              </div>

              {/* Bowling Team */}
              <div className="flex items-center gap-2">
                <img 
                  src={getTeamLogo(bowlingTeam)} 
                  alt={bowlingTeam?.name} 
                  className="w-9 h-9 object-contain opacity-50"
                />
                <div>
                  <span className="text-[8px] bg-slate-800/80 border border-slate-700/50 text-slate-400 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                    Bowling
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-400 tracking-tight mt-0.5">{bowlingTeam?.name}</h2>
                </div>
              </div>
            </div>
            
            <div className="text-right shrink-0">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">Overs Limit</span>
              <span className="text-base font-bold text-slate-400">{oversLimit} Overs</span>
            </div>
          </div>

          {/* Large Scoring Center */}
          <div className="my-3 flex flex-col items-center justify-center text-center">
            <div className="flex items-baseline gap-2">
              <span className="text-7xl sm:text-8xl font-black text-emerald-400 tracking-tighter drop-shadow-xl flex items-center overflow-hidden h-[75px] sm:h-[90px]">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={activeInningRuns}
                    initial={{ y: -25, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 25, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 20 }}
                  >
                    {activeInningRuns}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="text-5xl sm:text-6xl font-black text-slate-700">/</span>
              <span className="text-5xl sm:text-6xl font-black text-white drop-shadow-md flex items-center overflow-hidden h-[50px] sm:h-[60px]">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={activeInningWickets}
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 20 }}
                  >
                    {activeInningWickets}
                  </motion.span>
                </AnimatePresence>
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1 flex items-center justify-center gap-1.5 overflow-hidden h-8">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={activeOversStr}
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 10, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeOversStr}
                </motion.span>
              </AnimatePresence>
              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Overs</span>
            </div>
          </div>

          {/* Win Probability LED Bar */}
          {t1 && t2 && (
            <div className="bg-slate-900/30 border border-slate-900/60 p-2 mb-2 space-y-1">
              <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-wider text-slate-500">
                <span>Win Probability (Audience Poll)</span>
                <span>{isVotingLocked ? '🔒 Closed' : '🗳️ Live'}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-400 w-9 text-left">{t1.short_name}</span>
                <div className="flex-1 h-3.5 bg-slate-950 rounded-full overflow-hidden flex border border-slate-850">
                  <div 
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full flex items-center justify-start pl-2.5 text-[9px] font-black text-slate-950 transition-all duration-500"
                    style={{ width: `${pctT1}%` }}
                  >
                    {pctT1 >= 15 && `${pctT1}%`}
                  </div>
                  <div 
                    className="bg-gradient-to-r from-violet-600 to-indigo-500 h-full flex items-center justify-end pr-2.5 text-[9px] font-black text-white transition-all duration-500"
                    style={{ width: `${pctT2}%` }}
                  >
                    {pctT2 >= 15 && `${pctT2}%`}
                  </div>
                </div>
                <span className="text-xs font-black text-slate-400 w-9 text-right">{t2.short_name}</span>
              </div>
            </div>
          )}

          {/* Target / Inning summary info */}
          <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-2">
            {isSecondInning ? (
              <>
                <div className="space-y-0.5 text-center sm:text-left">
                  <span className="text-xs text-slate-400 block font-extrabold uppercase tracking-wider">
                    {isSuperOver ? 'SO Target:' : 'Target:'} <span className="text-amber-400 font-black text-base sm:text-lg">{target} Runs</span>
                  </span>
                  <span className="text-xs sm:text-sm text-slate-200 block font-bold">
                    Opponent <span className="text-emerald-400 font-black">{bowlingTeam?.short_name || 'Opponent'}</span> scored <span className="text-amber-400 font-black text-sm sm:text-base">{firstInningRuns} runs</span>
                  </span>
                </div>
                <div className="bg-slate-950 px-3.5 py-2 rounded-xl text-center border border-slate-800 shrink-0">
                  <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">Requirement</span>
                  <span className="text-sm sm:text-base font-black text-emerald-400">
                    Need {runsNeeded} Runs off {ballsRemaining} Balls
                  </span>
                </div>
              </>
            ) : (
              <div className="w-full text-center sm:text-left space-y-0.5">
                <span className="text-xs text-slate-400 block font-extrabold uppercase tracking-wider">
                  {isSuperOver 
                    ? `Super Over ${Math.floor((matchInnings.length - 1) / 2) + 1} - Inn 01` 
                    : 'First Inning'}
                </span>
                <span className="text-sm text-slate-200 block font-bold">
                  Setting Target for <span className="text-emerald-400 font-black">{bowlingTeam?.short_name || 'Opponent'}</span>
                </span>
                <span className="text-xs text-slate-400 block font-semibold">
                  Projected Score: <span className="text-amber-400 font-black text-sm sm:text-base">{activeLegalBalls > 0 ? Math.round((activeInningRuns / activeLegalBalls) * totalBallsLimit) : 0}</span> runs (at current RR)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Batsmen, Bowler, and Live Timeline */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-800/80 flex flex-col justify-between bg-slate-950/20">
          
          {/* Batsmen Display */}
          <div className="space-y-4">
            <h4 className="text-[10px] text-slate-500 font-black uppercase tracking-wider border-b border-slate-900 pb-2">Active Batsmen</h4>
            
            {/* Striker */}
            <div className={`p-3.5 rounded-2xl border ${striker ? 'bg-slate-900/90 border-slate-750 shadow-md' : 'bg-slate-950/30 border-slate-900/50'} flex justify-between items-center`}>
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🏏</span>
                <div>
                  <span className="text-sm sm:text-base font-extrabold text-white block">
                    {striker ? striker.name : 'Waiting...'}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Striker</span>
                </div>
              </div>
              {strikerStats && (
                <div className="text-right">
                  <span className="text-xl sm:text-2xl font-black text-emerald-400 block">
                    {strikerStats.runs} <span className="text-xs font-bold text-slate-400">({strikerStats.balls})</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold block">
                    {strikerStats.fours}x4 / {strikerStats.sixes}x6 <span className="text-amber-400 font-bold ml-1">SR: {strikerStats.balls > 0 ? ((strikerStats.runs / strikerStats.balls) * 100).toFixed(1) : '0.0'}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Non-Striker */}
            <div className={`p-3.5 rounded-2xl border ${nonStriker ? 'bg-slate-900/60 border-slate-800/80' : 'bg-slate-950/30 border-slate-900/50'} flex justify-between items-center`}>
              <div className="flex items-center gap-2.5">
                <span className="text-xl text-slate-500">👤</span>
                <div>
                  <span className="text-xs sm:text-sm font-bold text-slate-200 block">
                    {nonStriker ? nonStriker.name : 'Waiting...'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Non-Striker</span>
                </div>
              </div>
              {nonStrikerStats && (
                <div className="text-right">
                  <span className="text-lg sm:text-xl font-extrabold text-slate-200 block">
                    {nonStrikerStats.runs} <span className="text-xs font-semibold text-slate-400">({nonStrikerStats.balls})</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium block">
                    {nonStrikerStats.fours}x4 / {nonStrikerStats.sixes}x6 <span className="text-slate-400 font-bold ml-1">SR: {nonStrikerStats.balls > 0 ? ((nonStrikerStats.runs / nonStrikerStats.balls) * 100).toFixed(1) : '0.0'}</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bowler Display */}
          <div className="space-y-4 my-4">
            <h4 className="text-[10px] text-slate-500 font-black uppercase tracking-wider border-b border-slate-900 pb-2">Active Bowler</h4>
            <div className={`p-3.5 rounded-2xl border ${bowler ? 'bg-slate-900/90 border-slate-750 shadow-md' : 'bg-slate-950/30 border-slate-900/50'} flex justify-between items-center`}>
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🥎</span>
                <div>
                  <span className="text-sm sm:text-base font-extrabold text-white block">
                    {bowler ? bowler.name : 'Waiting...'}
                  </span>
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">{bowlingTeam?.name}</span>
                </div>
              </div>
              {bowlerStats && (
                <div className="text-right">
                  <span className="text-xl sm:text-2xl font-black text-amber-400 block">
                    {bowlerStats.wickets} <span className="text-xs font-bold text-slate-400">wkt</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold block">
                    {bowlerStats.overs} ov / {bowlerStats.runs} runs
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Over Timeline & Stats details */}
          <div className="space-y-3 pt-3 border-t border-slate-900">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-500">
              <span>Over Timeline</span>
              {lastOverInfo && (
                <span className="text-emerald-400">
                  Last Over (Ov {lastOverInfo.overNum}): {lastOverInfo.runs} runs
                </span>
              )}
            </div>
            {renderRecentBalls()}
            
            <div className="grid grid-cols-2 gap-2 text-center pt-2">
              <div className="bg-slate-950/90 border border-slate-800 p-2.5 rounded-xl">
                <span className="text-[9px] text-slate-500 font-black block uppercase tracking-wider">Current RR</span>
                <span className="text-base sm:text-lg font-black text-white">{crr}</span>
              </div>
              <div className="bg-slate-950/90 border border-slate-800 p-2.5 rounded-xl">
                <span className="text-[9px] text-slate-500 font-black block uppercase tracking-wider">Required RR</span>
                <span className="text-base sm:text-lg font-black text-emerald-400">{isSecondInning ? rrr : 'N/A'}</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    );
  };

  // Tournament Completed Accolades Showcase
  const renderChampionsView = () => {
    // 1. Calculate stats caps
    const runsMap: Record<string, number> = {};
    const wicketsMap: Record<string, number> = {};
    const fieldingMap: Record<string, number> = {};

    filteredDeliveries.forEach((d) => {
      const deliveryInning = allInnings.find(i => i.id === d.inning);
      const deliveryMatch = deliveryInning ? matches.find(m => m.id === deliveryInning.match) : null;
      const isSpecialExtras = deliveryMatch?.special_extras || false;

      if (d.striker && d.extra_type !== 'Wide') {
        const runOffBat = d.runs_off_bat !== undefined && d.runs_off_bat !== null
          ? d.runs_off_bat
          : (d.extra_type === 'No Ball' ? (isSpecialExtras ? Math.max(0, (d.runs || 0) - 6) : Math.max(0, (d.runs || 0) - 1)) : (d.runs || 0));
        runsMap[d.striker] = (runsMap[d.striker] || 0) + runOffBat;
      }
      if (d.bawler && d.is_wicket && d.dismissal_type !== 'Run Out' && d.dismissal_type !== 'Retired Out' && d.dismissal_type !== 'None') {
        wicketsMap[d.bawler] = (wicketsMap[d.bawler] || 0) + 1;
      }
      if (d.is_wicket && (d.dismissal_type === 'Catch' || d.dismissal_type === 'Run Out') && d.fielder) {
        fieldingMap[d.fielder] = (fieldingMap[d.fielder] || 0) + 1;
      }
    });

    const getTopWinner = (map: Record<string, number>) => {
      const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
      if (sorted.length === 0) return null;
      const [pId, val] = sorted[0];
      const player = players.find(p => p.id === pId);
      return player ? { player, value: val, team: teams.find(t => t.id === player.team) } : null;
    };

    const orangeCap = getTopWinner(runsMap);
    const purpleCap = getTopWinner(wicketsMap);
    const bestFielder = getTopWinner(fieldingMap);
    
    // Man of the series info
    const mosPlayer = tournamentConfig?.man_of_the_series ? getPlayer(tournamentConfig.man_of_the_series) : null;
    const mosTeam = mosPlayer ? getTeam(mosPlayer.team) : null;
    const mosPerf = tournamentConfig?.mos_performance || '';

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[72vh] content-stretch items-stretch">
        
        {/* Left Column: Champions Team */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 flex flex-col justify-between items-center text-center relative overflow-hidden bg-gradient-to-b from-slate-950/40 via-amber-950/5 to-slate-950/40">
          <div className="absolute top-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />
          
          <span className="text-[10px] bg-amber-500/10 border border-amber-500/25 text-amber-400 font-extrabold px-3 py-1 rounded-full uppercase tracking-widest">
            🏆 Tournament Champions
          </span>

          <div className="my-auto py-6 flex flex-col items-center gap-4">
            <img 
              src={getTeamLogo(championTeam)} 
              alt={championTeam?.name} 
              className="w-36 h-36 object-contain drop-shadow-2xl animate-bounce"
            />
            <div>
              <h2 className="text-4xl font-black bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 bg-clip-text text-transparent tracking-tight">
                {championTeam ? championTeam.name : 'Unknown Team'}
              </h2>
              {championTeam?.captain && (() => {
                const captain = getPlayer(championTeam.captain);
                return captain ? (
                  <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-wider">
                    Captain: <span className="text-slate-200 font-semibold">{captain.name}</span>
                  </p>
                ) : null;
              })()}
            </div>
          </div>

          <div className="w-full border-t border-slate-900 pt-4 text-xs text-slate-500 font-bold uppercase tracking-wider">
            CONGRATULATIONS CHAMPIONS!
          </div>
        </div>

        {/* Middle Column: Leaderboard Cap Winners */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 flex flex-col justify-between bg-slate-950/20">
          
          <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-extrabold px-3 py-1 rounded-full uppercase tracking-widest self-center">
            🔥 Individual Awards & Caps
          </span>

          <div className="flex-1 flex flex-col justify-center gap-4 my-4">
            {/* Orange Cap */}
            {orangeCap && (
              <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-2xl flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-center justify-center text-xl text-amber-400">
                    🟠
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{orangeCap.player.name}</span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mt-0.5">{orangeCap.team?.name}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-amber-400 block">{orangeCap.value}</span>
                  <span className="text-[9px] text-slate-550 font-bold uppercase tracking-widest block">Total Runs</span>
                </div>
              </div>
            )}

            {/* Purple Cap */}
            {purpleCap && (
              <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-2xl flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-violet-500/10 border border-violet-500/25 rounded-xl flex items-center justify-center text-xl text-violet-400">
                    🟣
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{purpleCap.player.name}</span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mt-0.5">{purpleCap.team?.name}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-violet-400 block">{purpleCap.value}</span>
                  <span className="text-[9px] text-slate-550 font-bold uppercase tracking-widest block">Wickets</span>
                </div>
              </div>
            )}

            {/* Best Fielder */}
            {bestFielder && (
              <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-2xl flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center justify-center text-xl text-emerald-400">
                    🟢
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{bestFielder.player.name}</span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mt-0.5">{bestFielder.team?.name}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-emerald-400 block">{bestFielder.value}</span>
                  <span className="text-[9px] text-slate-550 font-bold uppercase tracking-widest block">Dismissals</span>
                </div>
              </div>
            )}
          </div>

          <div className="w-full border-t border-slate-900 pt-4 text-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Tournament statistical leaders
          </div>
        </div>

        {/* Right Column: Man of the Series */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 flex flex-col justify-between items-center text-center relative overflow-hidden bg-gradient-to-b from-slate-950/40 via-violet-950/5 to-slate-950/40">
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-[100px] pointer-events-none" />
          
          <span className="text-[10px] bg-violet-500/10 border border-violet-500/25 text-violet-400 font-extrabold px-3 py-1 rounded-full uppercase tracking-widest">
            🌟 Man of the Series
          </span>

          <div className="my-auto py-6 flex flex-col items-center gap-4">
            {mosPlayer?.photo ? (
              <img 
                src={getFileUrl('players', mosPlayer.id, mosPlayer.photo)} 
                alt={mosPlayer.name}
                className="w-32 h-32 rounded-full object-cover border-2 border-violet-500/30 shadow-xl"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-4xl shadow-xl">
                🎖️
              </div>
            )}
            <div>
              <h2 className="text-3xl font-black text-slate-100 tracking-tight">
                {mosPlayer ? mosPlayer.name : 'Not Decided'}
              </h2>
              <span className="text-xs bg-slate-900/60 border border-slate-850 px-2.5 py-1 rounded-lg text-slate-400 font-bold uppercase tracking-wider block mt-1">
                {mosTeam ? mosTeam.name : 'TBD'}
              </span>
            </div>
            {mosPerf && (
              <div className="bg-slate-900/80 border border-slate-850 p-4 rounded-2xl max-w-xs mt-2">
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">Performance Details</span>
                <span className="text-sm font-semibold text-slate-200 block mt-1 leading-relaxed">{mosPerf}</span>
              </div>
            )}
          </div>

          <div className="w-full border-t border-slate-900 pt-4 text-xs text-slate-500 font-bold uppercase tracking-wider">
            ACC LAUDED PERFORMER
          </div>
        </div>

      </div>
    );
  };

  // General Dashboard / Pre-Tournament view
  const renderGeneralDashboard = () => {
    const upcomingMatches = matches.filter(m => m.status === 'Upcoming');

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[72vh] content-stretch items-stretch">
        
        {/* Left Column: Live Indicator / Status */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-slate-800/80 flex flex-col justify-between relative overflow-hidden bg-slate-950/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-600"></span>
            </span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dashboard Idle</span>
          </div>

          <div className="my-auto py-10 flex flex-col items-center justify-center text-center">
            {!logoError ? (
              <img
                src="/logo.png"
                alt="Trischel Logo"
                onError={() => setLogoError(true)}
                className="w-24 h-24 object-contain rounded-2xl mb-6 drop-shadow-lg"
              />
            ) : (
              <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 p-4 rounded-2xl shadow-lg shadow-emerald-500/10 flex items-center justify-center w-20 h-20 shrink-0 mb-6 animate-pulse">
                <Trophy className="w-10 h-10 text-slate-950 font-bold" />
              </div>
            )}
            <h2 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-emerald-400 via-teal-200 to-violet-400 bg-clip-text text-transparent tracking-tight">
              TRISCHEL SPORTS ENCOUNTER - 2026
            </h2>
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-350 uppercase tracking-widest mt-2">
              CRICKET CHAMPIONSHIP
            </h3>
            <p className="text-xs text-slate-500 mt-4 max-w-xs leading-relaxed">
              LED Scoreboard Display is active and waiting for a live match to commence.
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-2xl text-center text-xs text-slate-400">
            Registered Teams: {teams.length} | Bracket Matches: {matches.length}
          </div>
        </div>

        {/* Right Column: Upcoming Matches Feed */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 flex flex-col justify-between bg-slate-950/20">
          <h4 className="text-[10px] text-slate-500 font-black uppercase tracking-widest border-b border-slate-900 pb-3">Upcoming Matches</h4>
          
          <div className="flex-1 overflow-y-auto my-4 space-y-3 pr-1 max-h-[350px]">
            {upcomingMatches.slice(0, 4).map(m => {
              const t1 = getTeam(m.team1);
              const t2 = getTeam(m.team2);
              return (
                <div key={m.id} className="p-3 bg-slate-900/60 border border-slate-850 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-black block uppercase tracking-wider">
                      {m.stage}
                    </span>
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mt-0.5">
                      {t1 ? t1.short_name : 'TBD'}
                      <span className="text-slate-500 font-medium">vs</span>
                      {t2 ? t2.short_name : 'TBD'}
                    </span>
                  </div>
                  {m.match_time && (
                    <span className="text-[10px] bg-slate-950 border border-slate-800 text-slate-450 font-bold px-2 py-1 rounded">
                      {m.match_time}
                    </span>
                  )}
                </div>
              );
            })}
            {upcomingMatches.length === 0 && (
              <div className="text-center py-10 text-xs text-slate-500">
                No upcoming bracket matches scheduled.
              </div>
            )}
          </div>

          <div className="border-t border-slate-900 pt-4 text-center text-[9px] text-slate-500 font-black uppercase tracking-wider">
            LED Scoreboard Standby feed
          </div>
        </div>

      </div>
    );
  };

  return (
    <div className="w-full flex flex-col justify-between h-[85vh] py-2">
      
      {/* LED Header */}
      <header className="flex justify-between items-center border-b border-slate-900 pb-4 mb-4">
        <div className="flex items-center gap-3">
          {!logoError ? (
            <img
              src="/logo.png"
              alt="Trischel Logo"
              onError={() => setLogoError(true)}
              className="w-12 h-12 object-contain rounded-xl"
            />
          ) : (
            <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 p-2.5 rounded-xl shadow-lg shadow-emerald-500/10 flex items-center justify-center w-12 h-12 shrink-0">
              <Trophy className="w-6 h-6 text-slate-950 font-bold" />
            </div>
          )}
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white m-0 uppercase">
              TRISCHEL SPORTS ENCOUNTER - 2026
            </h1>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block mt-0.5">
              CRICKET CHAMPIONSHIP SCOREBOARD
            </span>
          </div>
        </div>

        {liveMatch ? (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5 rounded-full shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
              Live: {liveMatch.stage}
            </span>
          </div>
        ) : isTournamentEnded ? (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 rounded-full shrink-0">
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
              🏆 Tournament Ended
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Standby
            </span>
          </div>
        )}
      </header>

      {/* Main Display Body */}
      <main className="flex-1 my-2">
        {liveMatch 
          ? renderLiveScoreboard() 
          : isTournamentEnded 
            ? renderChampionsView() 
            : renderGeneralDashboard()
        }
      </main>

    </div>
  );
};
