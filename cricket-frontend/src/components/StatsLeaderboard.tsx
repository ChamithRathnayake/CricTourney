import React, { useEffect, useState } from 'react';
import { pb, getFileUrl, getTeamLogo } from '../services/pocketbase';
import type { Player, Team, Delivery, Match, TournamentConfig } from '../services/pocketbase';
import { Award, Flame, Sparkles, Crown, BarChart3, Activity, Layers } from 'lucide-react';
import { parseStage } from '../services/bracketUtils';

interface StatsLeaderboardProps {
  players: Player[];
  teams: Team[];
  matches: Match[];
  tournamentConfig: TournamentConfig | null;
}

interface LeaderboardEntry {
  player: Player;
  team: Team | undefined;
  value: number;
}

interface PlayerStats {
  batting: {
    inningsCount: number;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    outs: number;
    avg: string;
    sr: string;
  };
  bowling: {
    inningsCount: number;
    balls: number;
    runs: number;
    wickets: number;
    wides: number;
    noBalls: number;
    avg: string;
    econ: string;
    oversStr: string;
  };
}

export const StatsLeaderboard: React.FC<StatsLeaderboardProps> = ({ players, teams, matches, tournamentConfig }) => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [innings, setInnings] = useState<any[]>([]);
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'caps' | 'analytics'>('caps');

  const phaseSetting = tournamentConfig?.stats_from_phase || 'All';

  // Filter deliveries by tournament phase setting
  const filteredDeliveries = React.useMemo(() => {
    if (phaseSetting === 'All') return deliveries;

    const inningMap = new Map(innings.map(i => [i.id, i.match]));

    return deliveries.filter(d => {
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
  }, [deliveries, innings, phaseSetting, matches]);

  const formatPlayerName = (player: Player) => {
    if (tournamentConfig?.show_epf_number && player.epf_number) {
      return `${player.name} - ${player.epf_number}`;
    }
    return player.name;
  };

  const isTournamentEnded = matches.find(m => m.stage === 'Final')?.status === 'Completed';

  // Fetch all deliveries & innings to calculate stats
  const fetchDeliveries = async () => {
    try {
      setIsLoading(true);
      const [delRecords, innRecords] = await Promise.all([
        pb.collection('deliveries').getFullList<Delivery>({
          expand: 'striker,bawler,fielder,striker.team,bawler.team'
        }),
        pb.collection('innings').getFullList()
      ]);
      setDeliveries(delRecords);
      setInnings(innRecords);
    } catch (err) {
      console.error('Error fetching deliveries for stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();

    // Subscribe to deliveries to update stats in real-time
    pb.collection('deliveries').subscribe('*', () => {
      fetchDeliveries();
    });

    return () => {
      pb.collection('deliveries').unsubscribe('*');
    };
  }, []);

  // Compute all player batting and bowling tournament statistics
  useEffect(() => {
    if (filteredDeliveries.length === 0 || players.length === 0) return;

    const statsMap: Record<string, {
      batting: {
        innings: Set<string>;
        runs: number;
        balls: number;
        fours: number;
        sixes: number;
        outs: number;
      };
      bowling: {
        innings: Set<string>;
        balls: number;
        runs: number;
        wickets: number;
        wides: number;
        noBalls: number;
      };
    }> = {};

    players.forEach(p => {
      statsMap[p.id] = {
        batting: { innings: new Set(), runs: 0, balls: 0, fours: 0, sixes: 0, outs: 0 },
        bowling: { innings: new Set(), balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0 }
      };
    });

    filteredDeliveries.forEach(d => {
      const runs = d.runs || 0;
      const isWide = d.extra_type === 'Wide';
      const isNoBall = d.extra_type === 'No Ball';
      const isRetiredOut = d.dismissal_type === 'Retired Out';
      const isLegal = !isWide && !isNoBall && !isRetiredOut;

      if (d.striker && statsMap[d.striker]) {
        const stats = statsMap[d.striker].batting;
        stats.innings.add(d.inning);
        if (!isWide && !isRetiredOut) {
          const isByeOrLegBye = d.extra_type === 'Bye' || d.extra_type === 'Leg Bye';
          const runOffBat = isByeOrLegBye ? 0 : (isNoBall ? Math.max(0, runs - 1) : runs);
          stats.runs += runOffBat;
          stats.balls += 1;
          if (runOffBat === 4) stats.fours += 1;
          if (runOffBat === 6) stats.sixes += 1;
        }
        if ((d.is_wicket || isRetiredOut) && d.out_player === d.striker) {
          stats.outs += 1;
        }
      }

      if (d.bawler && statsMap[d.bawler]) {
        const stats = statsMap[d.bawler].bowling;
        stats.innings.add(d.inning);
        if (isLegal) {
          stats.balls += 1;
        }
        if (d.extra_type !== 'Bye' && d.extra_type !== 'Leg Bye') {
          stats.runs += runs;
        }
        if (d.is_wicket && d.dismissal_type !== 'Run Out' && d.dismissal_type !== 'Retired Out' && d.dismissal_type !== 'None') {
          stats.wickets += 1;
        }
        if (isWide) stats.wides += 1;
        if (isNoBall) stats.noBalls += 1;
      }

      if (d.is_wicket && d.out_player && d.out_player !== d.striker && statsMap[d.out_player]) {
        statsMap[d.out_player].batting.outs += 1;
        statsMap[d.out_player].batting.innings.add(d.inning);
      }
    });

    const finalMap: Record<string, PlayerStats> = {};
    Object.entries(statsMap).forEach(([pId, raw]) => {
      const batOuts = raw.batting.outs;
      const batRuns = raw.batting.runs;
      const batBalls = raw.batting.balls;

      const bowlBalls = raw.bowling.balls;
      const bowlRuns = raw.bowling.runs;
      const bowlWkts = raw.bowling.wickets;

      finalMap[pId] = {
        batting: {
          inningsCount: raw.batting.innings.size,
          runs: batRuns,
          balls: batBalls,
          fours: raw.batting.fours,
          sixes: raw.batting.sixes,
          outs: batOuts,
          avg: batOuts === 0 ? (batRuns > 0 ? `${batRuns}*` : '0.00') : (batRuns / batOuts).toFixed(2),
          sr: batBalls === 0 ? '0.00' : ((batRuns / batBalls) * 100).toFixed(2)
        },
        bowling: {
          inningsCount: raw.bowling.innings.size,
          balls: bowlBalls,
          runs: bowlRuns,
          wickets: bowlWkts,
          wides: raw.bowling.wides,
          noBalls: raw.bowling.noBalls,
          avg: bowlWkts === 0 ? 'N/A' : (bowlRuns / bowlWkts).toFixed(2),
          econ: bowlBalls === 0 ? '0.00' : (bowlRuns / (bowlBalls / 6)).toFixed(2),
          oversStr: `${Math.floor(bowlBalls / 6)}.${bowlBalls % 6}`
        }
      };
    });

    setPlayerStats(finalMap);
  }, [filteredDeliveries, players]);

  const getTeam = (teamId: string) => teams.find(t => t.id === teamId);

  // Aggregate Orange Cap (Most Runs)
  const getOrangeCap = (): LeaderboardEntry[] => {
    const runsMap: Record<string, number> = {};
    filteredDeliveries.forEach((d) => {
      if (!d.striker) return;
      if (d.extra_type !== 'Wide') {
        const isNoBall = d.extra_type === 'No Ball';
        const isByeOrLegBye = d.extra_type === 'Bye' || d.extra_type === 'Leg Bye';
        const runOffBat = isByeOrLegBye ? 0 : (isNoBall ? Math.max(0, (d.runs || 0) - 1) : (d.runs || 0));
        if (runOffBat > 0) {
          runsMap[d.striker] = (runsMap[d.striker] || 0) + runOffBat;
        }
      }
    });

    return Object.entries(runsMap)
      .map(([playerId, val]) => {
        const player = players.find(p => p.id === playerId);
        return {
          player: player!,
          team: player ? getTeam(player.team) : undefined,
          value: val
        };
      })
      .filter(entry => entry.player !== undefined)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  };

  // Aggregate Purple Cap (Most Wickets - excluding run outs and retired outs)
  const getPurpleCap = (): LeaderboardEntry[] => {
    const wicketsMap: Record<string, number> = {};
    filteredDeliveries.forEach((d) => {
      if (!d.bawler) return;
      if (d.is_wicket && d.dismissal_type !== 'Run Out' && d.dismissal_type !== 'Retired Out' && d.dismissal_type !== 'None') {
        wicketsMap[d.bawler] = (wicketsMap[d.bawler] || 0) + 1;
      }
    });

    return Object.entries(wicketsMap)
      .map(([playerId, val]) => {
        const player = players.find(p => p.id === playerId);
        return {
          player: player!,
          team: player ? getTeam(player.team) : undefined,
          value: val
        };
      })
      .filter(entry => entry.player !== undefined)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  };

  // Aggregate Best Fielder (Catches + Run Outs)
  const getBestFielder = (): LeaderboardEntry[] => {
    const fieldingMap: Record<string, number> = {};
    filteredDeliveries.forEach((d) => {
      if (d.is_wicket && (d.dismissal_type === 'Catch' || d.dismissal_type === 'Run Out') && d.fielder) {
        fieldingMap[d.fielder] = (fieldingMap[d.fielder] || 0) + 1;
      }
    });

    return Object.entries(fieldingMap)
      .map(([playerId, val]) => {
        const player = players.find(p => p.id === playerId);
        return {
          player: player!,
          team: player ? getTeam(player.team) : undefined,
          value: val
        };
      })
      .filter(entry => entry.player !== undefined)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  };

  const orangeCapList = getOrangeCap();
  const purpleCapList = getPurpleCap();
  const fielderList = getBestFielder();

  const renderTooltip = (_pId: string, capType: string, stats: PlayerStats) => {
    const isBowling = capType.includes('Purple');

    if (isBowling) {
      return (
        <div className="absolute bottom-[105%] left-1/2 -translate-x-1/2 mb-1 w-56 max-w-[calc(100vw-32px)] p-3.5 bg-slate-950/98 border border-slate-800 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-200 z-50 backdrop-blur-md text-left space-y-2">
          <div className="text-[10px] font-black uppercase text-violet-400 tracking-wider border-b border-slate-900 pb-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>Bowling Statistics</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
            <div>
              <span className="text-slate-500 font-semibold block">Innings:</span>
              <span className="text-slate-350 font-bold">{stats.bowling.inningsCount}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Overs:</span>
              <span className="text-slate-350 font-bold">{stats.bowling.oversStr}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Wickets:</span>
              <span className="text-emerald-400 font-black">{stats.bowling.wickets}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Economy:</span>
              <span className="text-slate-350 font-bold">{stats.bowling.econ}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Runs:</span>
              <span className="text-slate-355 font-bold">{stats.bowling.runs}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Average:</span>
              <span className="text-slate-350 font-bold">{stats.bowling.avg}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Wides:</span>
              <span className="text-amber-500 font-bold">{stats.bowling.wides}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">No Balls:</span>
              <span className="text-amber-500 font-bold">{stats.bowling.noBalls}</span>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="absolute bottom-[105%] left-1/2 -translate-x-1/2 mb-1 w-56 max-w-[calc(100vw-32px)] p-3.5 bg-slate-950/98 border border-slate-800 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-200 z-50 backdrop-blur-md text-left space-y-2">
          <div className="text-[10px] font-black uppercase text-amber-400 tracking-wider border-b border-slate-900 pb-1 flex items-center gap-1">
            <Flame className="w-3 h-3" />
            <span>Batting Statistics</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
            <div>
              <span className="text-slate-500 font-semibold block">Innings:</span>
              <span className="text-slate-350 font-bold">{stats.batting.inningsCount}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Total Runs:</span>
              <span className="text-emerald-400 font-black">{stats.batting.runs}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Average:</span>
              <span className="text-slate-350 font-bold">{stats.batting.avg}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Strike Rate:</span>
              <span className="text-slate-350 font-bold">{stats.batting.sr}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Balls faced:</span>
              <span className="text-slate-350 font-bold">{stats.batting.balls}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Outs:</span>
              <span className="text-slate-350 font-bold">{stats.batting.outs}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Fours (4s):</span>
              <span className="text-slate-350 font-bold">{stats.batting.fours}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Sixes (6s):</span>
              <span className="text-slate-350 font-bold">{stats.batting.sixes}</span>
            </div>
          </div>
        </div>
      );
    }
  };

  const renderLeaderboardCard = (
    title: string,
    sub: string,
    list: LeaderboardEntry[],
    typeLabel: string,
    glowClass: string,
    headerColorClass: string,
    IconComponent: React.ComponentType<{ className?: string }>
  ) => {
    return (
      <div className={`glass-panel rounded-3xl border border-slate-800/80 p-6 ${glowClass} transition-all duration-500 hover:scale-[1.01] flex flex-col justify-between overflow-visible`}>
        <div>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className={`p-2.5 rounded-xl border ${headerColorClass}`}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-100 tracking-tight">{title}</h3>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{sub}</p>
            </div>
          </div>

          {list.length === 0 ? (
            <div className="text-center py-16 text-xs text-slate-500 italic">No stats recorded yet</div>
          ) : (
            <div className="space-y-4">
              
              {/* #1 FEATURING CARD (Large Highlighting) */}
              {(() => {
                const leader = list[0];
                const playerPhoto = leader.player.photo ? getFileUrl('players', leader.player.id, leader.player.photo) : '';
                const teamLogo = getTeamLogo(leader.team);
                const stats = playerStats[leader.player.id];

                return (
                  <div className="relative group/tooltip bg-slate-950/70 border border-slate-805 p-4.5 rounded-2xl text-center shadow-lg transition-all duration-300 hover:border-emerald-500/20 hover:scale-[1.02] overflow-visible">
                    {/* Crown badge */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider shadow flex items-center gap-1">
                      <Crown className="w-2.5 h-2.5 fill-slate-950" />
                      <span>{isTournamentEnded ? 'Winner' : 'Leader'}</span>
                    </div>

                    {/* Large Photo */}
                    <div className="relative w-16 h-16 mx-auto mt-2 mb-3">
                      {playerPhoto ? (
                        <img 
                          src={playerPhoto} 
                          alt={leader.player.name}
                          className="w-full h-full rounded-full object-cover border-2 border-emerald-500/60 shadow-md shadow-emerald-500/5"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center text-md font-bold text-slate-400">
                          {leader.player.name.substring(0,2).toUpperCase()}
                        </div>
                      )}
                      {leader.team && (
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-950 border border-slate-850 flex items-center justify-center overflow-hidden">
                          {teamLogo ? (
                            <img src={teamLogo} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <span className="text-[7px] font-black text-slate-350">{leader.team.short_name}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <h4 className="text-xs font-black text-slate-100">{formatPlayerName(leader.player)}</h4>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mt-0.5">
                      {leader.team?.name || 'Unknown Team'}
                    </span>

                    {/* Leader value */}
                    <div className="mt-3 inline-flex items-center gap-1 bg-slate-900/60 px-3 py-1 rounded-full border border-slate-855">
                      <span className="text-sm font-black text-emerald-450">{leader.value}</span>
                      <span className="text-[8px] text-slate-550 uppercase font-black tracking-wider">{typeLabel}</span>
                    </div>

                    {stats && renderTooltip(leader.player.id, title, stats)}
                  </div>
                );
              })()}

              {/* #2 - #5 RUNNERS-UP LIST */}
              <div className="space-y-2.5">
                {list.slice(1).map((entry, idx) => {
                  const rankIndex = idx + 1; // 1 = #2, 2 = #3, 3 = #4, 4 = #5
                  const playerPhoto = entry.player.photo ? getFileUrl('players', entry.player.id, entry.player.photo) : '';
                  const teamLogo = getTeamLogo(entry.team);
                  const stats = playerStats[entry.player.id];

                  // More highlighting for #2 and #3
                  const isRank23 = rankIndex === 1 || rankIndex === 2;

                  return (
                    <div 
                      key={entry.player.id} 
                      className={`relative group/tooltip flex items-center justify-between p-2.5 rounded-xl border transition-all duration-200 overflow-visible hover:scale-[1.01] ${
                        isRank23 
                          ? 'bg-slate-950/45 border-slate-850 hover:border-slate-800 shadow-sm' 
                          : 'bg-slate-950/15 border-slate-900/60 hover:border-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`text-[10px] font-black ${
                          rankIndex === 1 ? 'text-slate-300' : rankIndex === 2 ? 'text-amber-700/80' : 'text-slate-600'
                        }`}>
                          #{rankIndex + 1}
                        </span>

                        {/* Photo */}
                        <div className="relative">
                          {playerPhoto ? (
                            <img 
                              src={playerPhoto} 
                              alt={entry.player.name}
                              className={`rounded-full object-cover border ${
                                isRank23 ? 'w-10 h-10 border-slate-750' : 'w-8.5 h-8.5 border-slate-850'
                              }`}
                            />
                          ) : (
                            <div className={`rounded-full bg-slate-900 border flex items-center justify-center font-bold text-slate-400 ${
                              isRank23 ? 'w-10 h-10 border-slate-750 text-[10px]' : 'w-8.5 h-8.5 border-slate-850 text-[9px]'
                            }`}>
                              {entry.player.name.substring(0,2).toUpperCase()}
                            </div>
                          )}
                          {entry.team && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-slate-950 border border-slate-855 flex items-center justify-center overflow-hidden">
                              {teamLogo ? (
                                <img src={teamLogo} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <span className="text-[5px] font-black text-slate-450">{entry.team.short_name}</span>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="text-xs font-bold text-slate-200 leading-tight">{formatPlayerName(entry.player)}</div>
                          <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                            {entry.team?.name || 'Unknown'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-xs font-extrabold ${isRank23 ? 'text-slate-200' : 'text-slate-405'}`}>
                          {entry.value}
                        </span>
                        <span className="text-[8px] text-slate-550 ml-0.5">{typeLabel}</span>
                      </div>

                      {stats && renderTooltip(entry.player.id, title, stats)}
                    </div>
                  );
                })}
              </div>

            </div>
          )}
        </div>
      </div>
    );
  };

  const analyticsData = React.useMemo(() => {
    let totalRuns = 0;
    let totalBalls = 0;
    let totalWickets = 0;
    let foursCount = 0;
    let sixesCount = 0;
    let dotBallsCount = 0;

    let powerplayRuns = 0, powerplayBalls = 0, powerplayWkts = 0;
    let middleRuns = 0, middleBalls = 0, middleWkts = 0;
    let deathRuns = 0, deathBalls = 0, deathWkts = 0;

    filteredDeliveries.forEach(d => {
      const runs = d.runs || 0;
      const isWide = d.extra_type === 'Wide';
      const isNoBall = d.extra_type === 'No Ball';
      const isLegal = !isWide && !isNoBall;

      totalRuns += runs;
      if (isLegal) totalBalls += 1;
      if (d.is_wicket && d.dismissal_type !== 'Retired Out') totalWickets += 1;

      if (d.runs_off_bat === 4) foursCount += 1;
      if (d.runs_off_bat === 6) sixesCount += 1;
      if (runs === 0 && d.extra_type === 'None') dotBallsCount += 1;

      const overNum = d.over_number || 0;
      if (overNum < 2) {
        powerplayRuns += runs;
        if (isLegal) powerplayBalls += 1;
        if (d.is_wicket && d.dismissal_type !== 'Retired Out') powerplayWkts += 1;
      } else if (overNum < 4) {
        middleRuns += runs;
        if (isLegal) middleBalls += 1;
        if (d.is_wicket && d.dismissal_type !== 'Retired Out') middleWkts += 1;
      } else {
        deathRuns += runs;
        if (isLegal) deathBalls += 1;
        if (d.is_wicket && d.dismissal_type !== 'Retired Out') deathWkts += 1;
      }
    });

    const boundaryRuns = (foursCount * 4) + (sixesCount * 6);
    const boundaryPct = totalRuns === 0 ? 0 : Math.round((boundaryRuns / totalRuns) * 100);
    const dotPct = totalBalls === 0 ? 0 : Math.round((dotBallsCount / totalBalls) * 100);

    return {
      totalRuns,
      totalBalls,
      totalWickets,
      foursCount,
      sixesCount,
      boundaryRuns,
      boundaryPct,
      dotBallsCount,
      dotPct,
      powerplay: { runs: powerplayRuns, balls: powerplayBalls, wkts: powerplayWkts, rr: powerplayBalls === 0 ? '0.0' : ((powerplayRuns / powerplayBalls) * 6).toFixed(1) },
      middle: { runs: middleRuns, balls: middleBalls, wkts: middleWkts, rr: middleBalls === 0 ? '0.0' : ((middleRuns / middleBalls) * 6).toFixed(1) },
      death: { runs: deathRuns, balls: deathBalls, wkts: deathWkts, rr: deathBalls === 0 ? '0.0' : ((deathRuns / deathBalls) * 6).toFixed(1) }
    };
  }, [filteredDeliveries]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500 border-r-2 border-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      
      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-teal-200 to-violet-400 bg-clip-text text-transparent">
          Stats & Tournament Analytics
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          {isTournamentEnded 
            ? 'Tournament cap winners and full performance analytics' 
            : 'Real-time tournament-wide statistical caps and interactive performance insights'}
        </p>

        {/* Phase Filter Badge Indicator */}
        {phaseSetting !== 'All' && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 bg-violet-500/10 border border-violet-500/25 rounded-full text-[10px] font-extrabold text-violet-400 uppercase tracking-widest">
            <Layers className="w-3 h-3" />
            <span>Calculating Stats From: {phaseSetting} Onwards</span>
          </div>
        )}

        {/* Sub Navigation Bar */}
        <div className="flex justify-center mt-6">
          <div className="flex items-center p-1 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveSubTab('caps')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'caps'
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Crown className="w-4 h-4 text-amber-400" />
              <span>Caps & Awards</span>
            </button>
            <button
              onClick={() => setActiveSubTab('analytics')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'analytics'
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>Advanced Analytics</span>
            </button>
          </div>
        </div>
      </div>

      {activeSubTab === 'caps' ? (
        <>
          {/* Grid containing the 3 Caps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {renderLeaderboardCard(
              'Orange Cap', 
              'Most Runs Scored', 
              orangeCapList, 
              'runs', 
              'neon-glow-amber', 
              'bg-amber-500/10 border-amber-500/20 text-amber-400', 
              Flame
            )}
            {renderLeaderboardCard(
              'Purple Cap', 
              'Most Wickets Taken', 
              purpleCapList, 
              'wkts', 
              'neon-glow-violet', 
              'bg-violet-500/10 border-violet-500/20 text-violet-400', 
              Sparkles
            )}
            {renderLeaderboardCard(
              'Best Fielder', 
              'Catches + Run Outs', 
              fielderList, 
              'outs', 
              'neon-glow-emerald', 
              'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', 
              Award
            )}
          </div>
        </>
      ) : (
        /* ADVANCED ANALYTICAL DASHBOARD VIEW */
        <div className="space-y-8 animate-fade-in">
          
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-panel p-4 rounded-2xl border border-slate-800/80 text-center bg-slate-950/40">
              <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest block">Total Tournament Runs</span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1 block">{analyticsData.totalRuns}</span>
              <span className="text-[9px] text-slate-500 block mt-1">{Math.floor(analyticsData.totalBalls / 6)}.{analyticsData.totalBalls % 6} overs bowled</span>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800/80 text-center bg-slate-950/40">
              <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest block">Total Wickets Fallen</span>
              <span className="text-2xl sm:text-3xl font-black text-rose-400 mt-1 block">{analyticsData.totalWickets}</span>
              <span className="text-[9px] text-slate-500 block mt-1">Tournament Wickets</span>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800/80 text-center bg-slate-950/40">
              <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest block">Boundary Run %</span>
              <span className="text-2xl sm:text-3xl font-black text-amber-400 mt-1 block">{analyticsData.boundaryPct}%</span>
              <span className="text-[9px] text-slate-500 block mt-1">{analyticsData.boundaryRuns} runs in boundaries</span>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800/80 text-center bg-slate-950/40">
              <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest block">Tournament Dot Ball %</span>
              <span className="text-2xl sm:text-3xl font-black text-violet-400 mt-1 block">{analyticsData.dotPct}%</span>
              <span className="text-[9px] text-slate-500 block mt-1">{analyticsData.dotBallsCount} dot deliveries</span>
            </div>
          </div>

          {/* Phase-wise Analytics Breakdown */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Overs Phase Performance Breakdown
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Powerplay */}
              <div className="bg-slate-950/50 border border-slate-850 p-5 rounded-xl space-y-3 relative overflow-hidden">
                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">Powerplay (Overs 1 - 2)</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">{analyticsData.powerplay.rr} RPO</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold block">Runs</span>
                    <span className="font-extrabold text-slate-200">{analyticsData.powerplay.runs}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold block">Balls</span>
                    <span className="font-extrabold text-slate-200">{analyticsData.powerplay.balls}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold block">Wickets</span>
                    <span className="font-extrabold text-rose-400">{analyticsData.powerplay.wkts}</span>
                  </div>
                </div>
              </div>

              {/* Middle Overs */}
              <div className="bg-slate-950/50 border border-slate-850 p-5 rounded-xl space-y-3 relative overflow-hidden">
                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                  <span className="text-xs font-black text-teal-400 uppercase tracking-wider">Middle Overs (Overs 3 - 4)</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">{analyticsData.middle.rr} RPO</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold block">Runs</span>
                    <span className="font-extrabold text-slate-200">{analyticsData.middle.runs}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold block">Balls</span>
                    <span className="font-extrabold text-slate-200">{analyticsData.middle.balls}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold block">Wickets</span>
                    <span className="font-extrabold text-rose-400">{analyticsData.middle.wkts}</span>
                  </div>
                </div>
              </div>

              {/* Death Overs */}
              <div className="bg-slate-950/50 border border-slate-850 p-5 rounded-xl space-y-3 relative overflow-hidden">
                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                  <span className="text-xs font-black text-amber-400 uppercase tracking-wider">Death Overs (Overs 5+)</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">{analyticsData.death.rr} RPO</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold block">Runs</span>
                    <span className="font-extrabold text-slate-200">{analyticsData.death.runs}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold block">Balls</span>
                    <span className="font-extrabold text-slate-200">{analyticsData.death.balls}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold block">Wickets</span>
                    <span className="font-extrabold text-rose-400">{analyticsData.death.wkts}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Boundaries Tracker Panel */}
      {filteredDeliveries.length > 0 && (() => {
        const totalSixes = filteredDeliveries.filter(d => d.runs_off_bat === 6).length;
        const totalFours = filteredDeliveries.filter(d => d.runs_off_bat === 4).length;

        const teamStats = teams.map(team => {
          const teamDels = filteredDeliveries.filter(d => d.expand?.striker?.team === team.id);
          const sixes = teamDels.filter(d => d.runs_off_bat === 6).length;
          const fours = teamDels.filter(d => d.runs_off_bat === 4).length;
          return {
            team,
            sixes,
            fours,
            total: sixes + fours
          };
        }).sort((a, b) => b.total - a.total);

        return (
          <div className="mt-12 glass-panel p-6 rounded-2xl border border-slate-800/80 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
            
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-6 flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-400" />
              Tournament Boundaries Tracker
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Overall Summary Cards */}
              <div className="space-y-4">
                <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4.5 text-center relative overflow-hidden group hover:border-violet-500/30 transition-all duration-300 shadow-lg">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-violet-500/5 rounded-full blur-xl pointer-events-none" />
                  <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest block">Overall Tournament Sixes</span>
                  <span className="text-4xl font-black text-violet-400 mt-2 block drop-shadow-md">{totalSixes}</span>
                  <span className="text-[9px] text-slate-400 mt-1 block uppercase font-bold tracking-wide">Massive Hits 🚀</span>
                </div>

                <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4.5 text-center relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300 shadow-lg">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
                  <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest block">Overall Tournament Fours</span>
                  <span className="text-4xl font-black text-emerald-400 mt-2 block drop-shadow-md">{totalFours}</span>
                  <span className="text-[9px] text-slate-400 mt-1 block uppercase font-bold tracking-wide">Cracking Boundaries 🔥</span>
                </div>
              </div>

              {/* Right Column: Team standings (Takes up 2 columns) */}
              <div className="lg:col-span-2 bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 sm:p-5">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-4">Team Boundaries Standings</span>
                
                <div className="overflow-x-auto scrollbar-none">
                  <table className="w-full text-left border-collapse min-w-[400px]">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        <th className="py-2.5">Team</th>
                        <th className="py-2.5 text-center">Fours (4s)</th>
                        <th className="py-2.5 text-center">Sixes (6s)</th>
                        <th className="py-2.5 text-right">Total Boundaries</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs">
                      {teamStats.map(({ team, fours, sixes, total }) => {
                        const logoUrl = getTeamLogo(team);
                        return (
                          <tr key={team.id} className="hover:bg-slate-900/25 transition-colors">
                            <td className="py-3 flex items-center gap-2.5 font-bold text-slate-200">
                              <div className="w-6.5 h-6.5 rounded-lg overflow-hidden border border-slate-850 shrink-0 bg-slate-950/40 flex items-center justify-center">
                                {logoUrl ? (
                                  <img src={logoUrl} className="w-full h-full object-cover" alt="" />
                                ) : (
                                  <span className="text-[6px] font-black text-slate-400 uppercase">{team.short_name}</span>
                                )}
                              </div>
                              <span className="truncate max-w-[150px] sm:max-w-none">{team.name}</span>
                            </td>
                            <td className="py-3 text-center">
                              <span className="px-2 py-1 bg-emerald-500/10 text-emerald-450 border border-emerald-500/15 rounded-lg font-extrabold text-[10px]">{fours}</span>
                            </td>
                            <td className="py-3 text-center">
                              <span className="px-2 py-1 bg-violet-500/10 text-violet-400 border border-violet-500/15 rounded-lg font-extrabold text-[10px]">{sixes}</span>
                            </td>
                            <td className="py-3 text-right font-black text-slate-100 text-sm">
                              {total}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
};
