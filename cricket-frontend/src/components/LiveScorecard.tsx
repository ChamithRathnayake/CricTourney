import React, { useEffect, useState, useRef } from 'react';
import { pb, getFileUrl, getTeamLogo } from '../services/pocketbase';
import type { Match, Team, Inning, Delivery, Player, TournamentConfig, MatchVote } from '../services/pocketbase';
import { Users, Trophy, X, Clock, ChevronRight, Sparkles, Flame, Medal, User, CloudRain, AlertTriangle, TrendingUp, BarChart2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DragScrollContainerProps {
  children: React.ReactNode;
  className?: string;
}

const DragScrollContainer: React.FC<DragScrollContainerProps> = ({ children, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollLeft = container.scrollWidth;
    }
  }, [children]);

  const onMouseDown = (e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;
    setIsDown(true);
    container.classList.add('cursor-grabbing');
    container.classList.remove('cursor-grab');
    setStartX(e.pageX - container.offsetLeft);
    setScrollLeft(container.scrollLeft);
  };

  const onMouseLeave = () => {
    setIsDown(false);
    const container = containerRef.current;
    if (container) {
      container.classList.remove('cursor-grabbing');
      container.classList.add('cursor-grab');
    }
  };

  const onMouseUp = () => {
    setIsDown(false);
    const container = containerRef.current;
    if (container) {
      container.classList.remove('cursor-grabbing');
      container.classList.add('cursor-grab');
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDown) return;
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 1.5;
    container.scrollLeft = scrollLeft - walk;
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      onMouseLeave={onMouseLeave}
      onMouseUp={onMouseUp}
      onMouseMove={onMouseMove}
      className={`flex items-center gap-2 overflow-x-auto py-1 scrollbar-none cursor-grab active:cursor-grabbing select-none ${className}`}
    >
      {children}
    </div>
  );
};

interface LiveScorecardProps {
  matches: Match[];
  teams: Team[];
  players: Player[];
  tournamentConfig: TournamentConfig | null;
}

export const LiveScorecard: React.FC<LiveScorecardProps> = ({ matches, teams, players, tournamentConfig }) => {
  const formatPlayerName = (player: Player | null | undefined, teamId?: string) => {
    if (!player) return '';
    const team = teams.find(t => t.id === (teamId || player.team));
    let baseName = player.name;
    if (tournamentConfig?.show_epf_number && player.epf_number) {
      baseName = `${player.name} - ${player.epf_number}`;
    }
    if (team && team.captain === player.id) {
      return `${baseName} (C)`;
    }
    return baseName;
  };

  const getMatchWinner = (match: Match, matchInnings: Inning[], deliveriesList: Delivery[]) => {
    if (match.status === 'Completed') {
      return teams.find(t => t.id === match.winner) || null;
    }

    if (match.status === 'Live' && matchInnings.length >= 2 && matchInnings.length % 2 === 0) {
      const isSuperOver = matchInnings.length > 2;
      const firstInning = matchInnings[matchInnings.length - 2];
      const secondInning = matchInnings[matchInnings.length - 1];
      const firstInningState = getInningState(firstInning, deliveriesList);
      const secondInningState = getInningState(secondInning, deliveriesList);

      const target = firstInningState.totalRuns + 1;
      const oversLimit = isSuperOver ? 1 : (match.overs_limit || 5);
      const maxWickets = isSuperOver ? 2 : 10;
      const maxBalls = oversLimit * 6;

      if (secondInningState.totalRuns >= target) {
        return teams.find(t => t.id === secondInning.batting_team) || null;
      }

      const isAllOut = secondInningState.totalWickets >= maxWickets;
      const isOversOver = secondInningState.totalBalls >= maxBalls;

      if (isAllOut || isOversOver) {
        if (secondInningState.totalRuns === target - 1) {
          return null; // Tie: scores are level, no winner selected automatically
        }
        if (secondInningState.totalRuns < target - 1) {
          return teams.find(t => t.id === secondInning.bawling_team) || null;
        }
      }
    }

    return null;
  };

  interface TickerItem {
    type: 'ball' | 'over-divider';
    id: string;
    label: string;
    badgeClass: string;
    overNum?: number;
    overRuns?: number;
  }

  const getRecentBallsTicker = (inningDeliveries: Delivery[], isInningComplete = false) => {
    // Group deliveries by over to calculate total runs in each over
    const overRunsMap: Record<number, number> = {};
    inningDeliveries.forEach(d => {
      overRunsMap[d.over_number] = (overRunsMap[d.over_number] || 0) + (d.runs || 0);
    });

    const chronoItems: TickerItem[] = [];
    inningDeliveries.forEach((d, idx) => {
      let label = `${d.runs}`;
      let badgeClass = "bg-slate-800 text-slate-300 border border-slate-700/60";

      if (d.is_wicket) {
        if (d.dismissal_type === 'Run Out') {
          const deliveryInning = allInnings.find(i => i.id === d.inning);
          const deliveryMatch = deliveryInning ? matches.find(m => m.id === deliveryInning.match) : null;
          const isSpecialExtras = deliveryMatch?.special_extras || false;

          const isWide = d.extra_type === 'Wide';
          const isNoBall = d.extra_type === 'No Ball';
          const completedRuns = isSpecialExtras
            ? (isWide ? Math.max(0, (d.runs || 0) - 4) : (isNoBall ? Math.max(0, (d.runs || 0) - 6) : (d.runs || 0)))
            : (isWide || isNoBall ? Math.max(0, (d.runs || 0) - 1) : (d.runs || 0));

          if (completedRuns > 0) {
            if (d.extra_type === 'Wide') label = `W+${completedRuns}wd`;
            else if (d.extra_type === 'No Ball') label = `W+${completedRuns}nb`;
            else if (d.extra_type === 'Bye') label = `W+${completedRuns}b`;
            else if (d.extra_type === 'Leg Bye') label = `W+${completedRuns}lb`;
            else label = `W+${completedRuns}`;
          } else {
            if (d.extra_type === 'Wide') label = "W+wd";
            else if (d.extra_type === 'No Ball') label = "W+nb";
            else label = "W";
          }
        } else {
          label = "W";
        }
        badgeClass = "bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold";
      } else if (d.extra_type === 'Wide') {
        label = `${d.runs}wd`;
        badgeClass = "bg-slate-800 text-amber-400 border border-slate-700/60";
      } else if (d.extra_type === 'No Ball') {
        label = `${d.runs}nb`;
        badgeClass = "bg-slate-800 text-amber-500 border border-slate-750 font-semibold";
      } else if (d.extra_type === 'Bye') {
        label = `${d.runs}b`;
      } else if (d.extra_type === 'Leg Bye') {
        label = `${d.runs}lb`;
      } else {
        if (d.runs === 0) {
          label = "•";
          badgeClass = "bg-slate-800/40 text-slate-500 border border-slate-800/60";
        } else if (d.runs === 4) {
          label = "4";
          badgeClass = "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-extrabold";
        } else if (d.runs === 6) {
          label = "6";
          badgeClass = "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-extrabold shadow-sm shadow-emerald-500/10";
        }
      }

      chronoItems.push({
        type: 'ball',
        id: `ball-${d.id}`,
        label,
        badgeClass
      });

      const nextDel = inningDeliveries[idx + 1];
      if (nextDel && nextDel.over_number !== d.over_number) {
        const overRuns = overRunsMap[d.over_number] || 0;
        chronoItems.push({
          type: 'over-divider',
          id: `div-${d.over_number}`,
          label: `${d.over_number + 1}th`,
          badgeClass: "",
          overNum: d.over_number + 1,
          overRuns
        });
      }
    });

    // Check if we need to add the final over divider (if the over is completed or inning complete)
    if (inningDeliveries.length > 0) {
      const lastDel = inningDeliveries[inningDeliveries.length - 1];
      const dividerExists = chronoItems.some(item => item.type === 'over-divider' && item.id === `div-${lastDel.over_number}`);
      if (!dividerExists) {
        if (lastDel.ball_number === 6 || isInningComplete) {
          const overRuns = overRunsMap[lastDel.over_number] || 0;
          chronoItems.push({
            type: 'over-divider',
            id: `div-${lastDel.over_number}`,
            label: `${lastDel.over_number + 1}th`,
            badgeClass: "",
            overNum: lastDel.over_number + 1,
            overRuns
          });
        }
      }
    }

    return chronoItems;
  };

  const [liveMatch, setLiveMatch] = useState<Match | null>(null);
  const [allInnings, setAllInnings] = useState<Inning[]>([]);
  const [allDeliveries, setAllDeliveries] = useState<Delivery[]>([]);
  const [votes, setVotes] = useState<MatchVote[]>([]);
  const [filterTab, setFilterTab] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const [prevDeliveryId, setPrevDeliveryId] = useState<string>('');
  const [showHighlight, setShowHighlight] = useState<'Wicket' | 'Four' | 'Six' | null>(null);

  // Popup Modal state for match details
  const [selectedPopupMatch, setSelectedPopupMatch] = useState<Match | null>(null);
  const [popupInningTab, setPopupInningTab] = useState<number>(0); // 0 = Inning 1, 1 = Inning 2
  const [openPopupToSquads, setOpenPopupToSquads] = useState<boolean>(false);

  // Popup selected match innings and deliveries
  const popupInnings = selectedPopupMatch ? allInnings.filter(i => i.match === selectedPopupMatch.id) : [];
  const popupDeliveries = selectedPopupMatch ? allDeliveries.filter(d => popupInnings.some(i => i.id === d.inning)) : [];

  // Analytics Modal state
  const [selectedAnalyticsMatch, setSelectedAnalyticsMatch] = useState<Match | null>(null);
  const [analyticsTab, setAnalyticsTab] = useState<'worm' | 'stats' | 'partnerships'>('worm');

  // Analytics selected match innings and deliveries
  const analyticsInnings = selectedAnalyticsMatch ? allInnings.filter(i => i.match === selectedAnalyticsMatch.id) : [];
  const analyticsDeliveries = selectedAnalyticsMatch ? allDeliveries.filter(d => analyticsInnings.some(i => i.id === d.inning)) : [];

  // Find the first live match for the hero banner
  const findLiveMatch = () => {
    const live = matches.find((m) => m.status === 'Live');
    setLiveMatch(live || null);
  };

  useEffect(() => {
    findLiveMatch();
  }, [matches]);

  const fetchAllTournamentDetails = async () => {
    try {
      const inningsList = await pb.collection('innings').getFullList<Inning>({
        sort: '+created'
      });
      setAllInnings(inningsList);

      const deliveriesList = await pb.collection('deliveries').getFullList<Delivery>({
        sort: '+created',
        expand: 'striker,bawler,out_player,fielder'
      });
      setAllDeliveries(deliveriesList);

      const votesList = await pb.collection('match_votes').getFullList<MatchVote>({
        requestKey: null
      });
      setVotes(votesList);
    } catch (err) {
      console.error('Error fetching all tournament details:', err);
    }
  };

  useEffect(() => {
    fetchAllTournamentDetails();
    pb.collection('innings').subscribe('*', () => fetchAllTournamentDetails());
    pb.collection('deliveries').subscribe('*', () => fetchAllTournamentDetails());
    pb.collection('match_votes').subscribe('*', () => fetchAllTournamentDetails());
    return () => {
      pb.collection('innings').unsubscribe('*');
      pb.collection('deliveries').unsubscribe('*');
      pb.collection('match_votes').unsubscribe('*');
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
            if (lastDel.is_wicket) {
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


  // Synchronize modal inning tab when selected match changes or when opening to squads
  useEffect(() => {
    if (selectedPopupMatch) {
      if (openPopupToSquads) {
        setPopupInningTab(popupInnings.length);
      } else {
        setPopupInningTab(0);
      }
    } else {
      setOpenPopupToSquads(false);
    }
  }, [selectedPopupMatch, popupInnings.length, openPopupToSquads]);

  // Lock body scroll when detailed scorecard or analytics modal is open
  useEffect(() => {
    if (selectedPopupMatch || selectedAnalyticsMatch) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedPopupMatch, selectedAnalyticsMatch]);

  const getTeam = (teamId: string) => teams.find(t => t.id === teamId);
  const getPlayer = (playerId: string) => players.find(p => p.id === playerId);
  const getTeamPlayers = (teamId: string) => players.filter(p => p.team === teamId);

  const getTeamColor = (team: Team) => {
    const hash = team.name.charCodeAt(0) + (team.short_name.charCodeAt(0) || 0);
    const GRAD_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6', '#3b82f6'];
    return GRAD_COLORS[hash % GRAD_COLORS.length];
  };

  const calculateWormData = (innDels: Delivery[], isSpecialExtras: boolean) => {
    const sorted = [...innDels].sort((a, b) => {
      if (a.over_number !== b.over_number) return a.over_number - b.over_number;
      return a.ball_number - b.ball_number;
    });

    let cumulativeRuns = 0;
    let legalBallsCount = 0;
    
    const points: { over: number; runs: number; isWicket: boolean; wicketPlayer?: string }[] = [
      { over: 0, runs: 0, isWicket: false }
    ];

    sorted.forEach((d) => {
      cumulativeRuns += d.runs;
      const isWide = d.extra_type === 'Wide';
      const isNoBall = d.extra_type === 'No Ball';
      const isLegal = isSpecialExtras ? true : (!isWide && !isNoBall);

      if (isLegal) {
        legalBallsCount += 1;
      }
      
      const overFraction = legalBallsCount / 6;
      points.push({
        over: overFraction,
        runs: cumulativeRuns,
        isWicket: d.is_wicket,
        wicketPlayer: d.is_wicket && d.out_player ? (players.find(p => p.id === d.out_player)?.name || 'Wicket') : undefined
      });
    });

    return points;
  };

  const getMaxRuns = (inn1Points: any[], inn2Points: any[]) => {
    const max1 = inn1Points.length > 0 ? inn1Points[inn1Points.length - 1].runs : 0;
    const max2 = inn2Points.length > 0 ? inn2Points[inn2Points.length - 1].runs : 0;
    const highest = Math.max(max1, max2);
    if (highest <= 20) return 20;
    if (highest <= 50) return 50;
    return Math.ceil(highest / 10) * 10;
  };

  const getPathD = (points: { over: number; runs: number }[], maxOvers: number, maxRuns: number) => {
    if (points.length === 0) return '';
    return points.map((p, idx) => {
      const x = 40 + (p.over / maxOvers) * 440;
      const y = 20 + 245 - (p.runs / maxRuns) * 245;
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  };

  const getMatchStatsComparison = (inn1: Inning | null, inn2: Inning | null, dels: Delivery[]) => {
    const getStatsForInning = (inn: Inning) => {
      const innDels = dels.filter(d => d.inning === inn.id);
      let dotBalls = 0;
      let fours = 0;
      let sixes = 0;
      let runsOffBat = 0;

      innDels.forEach((d) => {
        const runOffBat = d.runs_off_bat !== undefined && d.runs_off_bat !== null
          ? d.runs_off_bat
          : (d.extra_type === 'Bye' || d.extra_type === 'Leg Bye' ? 0 : (d.extra_type === 'Wide' ? 0 : d.runs));

        if (runOffBat === 4 && d.extra_type !== 'Wide') fours += 1;
        if (runOffBat === 6 && d.extra_type !== 'Wide') sixes += 1;
        if (runOffBat === 0 && d.extra_type === 'None') dotBalls += 1;
        runsOffBat += runOffBat;
      });

      const state = getInningState(inn, dels);
      const runRate = state.totalBalls > 0 ? ((state.totalRuns / state.totalBalls) * 6).toFixed(2) : '0.00';

      return {
        dotBalls,
        fours,
        sixes,
        runsOffBat,
        runRate,
        extras: state.totalExtras,
        wides: state.extrasWides,
        noBalls: state.extrasNoBalls,
        byes: state.extrasByes,
        legByes: state.extrasLegByes,
        totalRuns: state.totalRuns,
        totalWickets: state.totalWickets,
        overs: state.oversStr
      };
    };

    return {
      team1Stats: inn1 ? getStatsForInning(inn1) : null,
      team2Stats: inn2 ? getStatsForInning(inn2) : null
    };
  };

  const calculatePartnerships = (innDels: Delivery[], isSpecialExtras: boolean) => {
    const sorted = [...innDels].sort((a, b) => {
      if (a.over_number !== b.over_number) return a.over_number - b.over_number;
      return a.ball_number - b.ball_number;
    });

    const partnerships: {
      wicketNum: number;
      runs: number;
      balls: number;
      batters: string[];
      endedBy: string;
    }[] = [];

    let currentRuns = 0;
    let currentBalls = 0;
    let activeBatters = new Set<string>();
    let wicketCount = 0;

    sorted.forEach((d) => {
      if (d.striker) activeBatters.add(d.striker);
      currentRuns += d.runs;
      const isWide = d.extra_type === 'Wide';
      const isNoBall = d.extra_type === 'No Ball';
      const isLegal = isSpecialExtras ? true : (!isWide && !isNoBall);
      if (isLegal) currentBalls += 1;

      if (d.is_wicket) {
        wicketCount += 1;
        partnerships.push({
          wicketNum: wicketCount,
          runs: currentRuns,
          balls: currentBalls,
          batters: Array.from(activeBatters),
          endedBy: d.out_player ? (players.find(p => p.id === d.out_player)?.name || 'Wicket') : 'Wicket'
        });
        currentRuns = 0;
        currentBalls = 0;
        activeBatters = new Set<string>();
      }
    });

    if (currentRuns > 0 || currentBalls > 0 || activeBatters.size > 0) {
      partnerships.push({
        wicketNum: wicketCount + 1,
        runs: currentRuns,
        balls: currentBalls,
        batters: Array.from(activeBatters),
        endedBy: 'Not Out'
      });
    }

    return partnerships;
  };

  const getBatterNames = (batterIds: string[]) => {
    if (batterIds.length === 0) return 'No batters';
    return batterIds
      .map(id => players.find(p => p.id === id)?.name || 'Unknown')
      .join(' & ');
  };

  const getMatchSquads = (match: Match, teamId: string) => {
    const allPlayers = players.filter(p => p.team === teamId);
    const squadIds = teamId === match.team1 ? (match.team1_squad || []) : (match.team2_squad || []);

    if (squadIds.length === 0) {
      let savedSquad: string[] = [];
      try {
        const localData = localStorage.getItem(`squad_${match.id}`);
        if (localData) {
          const parsed = JSON.parse(localData);
          savedSquad = teamId === match.team1 ? (parsed.t1Squad || []) : (parsed.t2Squad || []);
        }
      } catch (e) {
        console.error(e);
      }

      if (savedSquad.length > 0) {
        const playing = allPlayers.filter(p => savedSquad.includes(p.id));
        const bench = allPlayers.filter(p => !savedSquad.includes(p.id));
        return { playing, bench };
      }

      return { playing: allPlayers, bench: [] };
    }

    const playing = allPlayers.filter(p => squadIds.includes(p.id));
    const bench = allPlayers.filter(p => !squadIds.includes(p.id));
    return { playing, bench };
  };

  // Run chronological simulation to compute innings details
  const getInningState = (inning: Inning, deliveriesList: Delivery[]) => {
    const inningDeliveries = deliveriesList.filter(d => d.inning === inning.id);
    const match = matches.find(m => m.id === inning.match);
    const isSpecialExtras = match?.special_extras || false;

    let totalRuns = 0;
    let totalWickets = 0;
    let totalBalls = 0;

    // Player lists
    const batsmanRuns: Record<string, number> = {};
    const batsmanBalls: Record<string, number> = {};
    const batsmanFours: Record<string, number> = {};
    const batsmanSixes: Record<string, number> = {};
    const batsmanDismissal: Record<string, string> = {};

    const bowlerRuns: Record<string, number> = {};
    const bowlerBalls: Record<string, number> = {};
    const bowlerWickets: Record<string, number> = {};
    const bowlerWides: Record<string, number> = {};
    const bowlerNoBalls: Record<string, number> = {};

    let extrasWides = 0;
    let extrasNoBalls = 0;
    let extrasByes = 0;
    let extrasLegByes = 0;

    let currentStrikerId = '';
    let currentNonStrikerId = '';
    let currentBowlerId = '';
    const currentOverDeliveries: Delivery[] = [];

    // Simulate each delivery
    inningDeliveries.forEach((d) => {
      const runs = d.runs || 0;
      totalRuns += runs;

      if (d.is_wicket) {
        totalWickets += 1;
      }

      const isWide = d.extra_type === 'Wide';
      const isNoBall = d.extra_type === 'No Ball';
      const isLegal = isSpecialExtras ? true : (!isWide && !isNoBall);

      if (isLegal) {
        totalBalls += 1;
      }

      const baseWide = isSpecialExtras ? 4 : 1;
      const baseNB = isSpecialExtras ? 6 : 1;
      const runOffBat = d.runs_off_bat !== undefined && d.runs_off_bat !== null
        ? d.runs_off_bat
        : (d.extra_type === 'Bye' || d.extra_type === 'Leg Bye'
          ? 0
          : (isNoBall
            ? (isSpecialExtras ? Math.max(0, runs - 6) : Math.max(0, runs - 1))
            : (isWide ? 0 : runs)));

      // Track extras
      if (d.extra_type === 'Wide') {
        extrasWides += baseWide;
        extrasByes += Math.max(0, runs - baseWide);
      } else if (d.extra_type === 'No Ball') {
        extrasNoBalls += baseNB;
        extrasByes += Math.max(0, runs - baseNB - runOffBat);
      } else if (d.extra_type === 'Bye') {
        extrasByes += runs;
      } else if (d.extra_type === 'Leg Bye') {
        extrasLegByes += runs;
      }

      // Striker stats
      if (d.striker) {
        if (!isWide) {
          batsmanRuns[d.striker] = (batsmanRuns[d.striker] || 0) + runOffBat;
          batsmanBalls[d.striker] = (batsmanBalls[d.striker] || 0) + 1;

          if (runOffBat === 4) {
            batsmanFours[d.striker] = (batsmanFours[d.striker] || 0) + 1;
          } else if (runOffBat === 6) {
            batsmanSixes[d.striker] = (batsmanSixes[d.striker] || 0) + 1;
          }
        }
        currentStrikerId = d.striker;

        // Dismissal mapping
        if (d.is_wicket && d.out_player) {
          const bowlerName = d.expand?.bawler?.name || 'Bowler';
          const fielderName = d.expand?.fielder?.name || 'Fielder';

          if (d.dismissal_type === 'Bawled') {
            batsmanDismissal[d.out_player] = `b. ${bowlerName}`;
          } else if (d.dismissal_type === 'Catch') {
            batsmanDismissal[d.out_player] = `c. ${fielderName} b. ${bowlerName}`;
          } else if (d.dismissal_type === 'Run Out') {
            batsmanDismissal[d.out_player] = `run out (${fielderName})`;
          } else if (d.dismissal_type === 'Stumped') {
            batsmanDismissal[d.out_player] = `st. ${fielderName} b. ${bowlerName}`;
          } else if (d.dismissal_type === 'Hit Wicket') {
            batsmanDismissal[d.out_player] = `hit wicket b. ${bowlerName}`;
          } else if (d.dismissal_type === 'Retired Out') {
            batsmanDismissal[d.out_player] = 'retired out';
          } else {
            batsmanDismissal[d.out_player] = 'out';
          }
        }
      }

      // Bowler stats
      if (d.bawler) {
        if (isLegal) {
          bowlerBalls[d.bawler] = (bowlerBalls[d.bawler] || 0) + 1;
        }
        if (d.extra_type !== 'Bye' && d.extra_type !== 'Leg Bye') {
          bowlerRuns[d.bawler] = (bowlerRuns[d.bawler] || 0) + runs;
        }
        if (d.is_wicket && d.dismissal_type !== 'Run Out' && d.dismissal_type !== 'Retired Out' && d.dismissal_type !== 'None') {
          bowlerWickets[d.bawler] = (bowlerWickets[d.bawler] || 0) + 1;
        }
        if (isWide) {
          bowlerWides[d.bawler] = (bowlerWides[d.bawler] || 0) + 1;
        }
        if (isNoBall) {
          bowlerNoBalls[d.bawler] = (bowlerNoBalls[d.bawler] || 0) + 1;
        }
        currentBowlerId = d.bawler;
      }

      // Track non-striker
      if (d.striker && d.striker !== currentStrikerId) {
        currentNonStrikerId = currentStrikerId;
      }
    });

    const totalOversCount = Math.floor(totalBalls / 6);
    const ballsInCurrentOver = totalBalls % 6;
    const currentOverNum = ballsInCurrentOver === 0 && totalBalls > 0 ? totalOversCount - 1 : totalOversCount;

    inningDeliveries.forEach((d) => {
      if (d.over_number === currentOverNum) {
        currentOverDeliveries.push(d);
      }
    });

    if (!currentNonStrikerId && inningDeliveries.length > 0) {
      const reversedDeliveries = [...inningDeliveries].reverse();
      for (const d of reversedDeliveries) {
        if (d.striker && d.striker !== currentStrikerId) {
          const isOut = inningDeliveries.some(item => item.is_wicket && item.out_player === d.striker);
          if (!isOut) {
            currentNonStrikerId = d.striker;
            break;
          }
        }
      }
    }

    // Rotate striker if over has finished (ball_number === 6)
    if (inningDeliveries.length > 0) {
      const lastDel = inningDeliveries[inningDeliveries.length - 1];
      const overFinished = lastDel.ball_number === 6;
      if (overFinished && currentStrikerId && currentNonStrikerId && !lastDel.is_wicket) {
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

    return {
      totalRuns,
      totalWickets,
      totalBalls,
      oversStr: `${Math.floor(totalBalls / 6)}.${totalBalls % 6}`,
      currentStrikerId,
      currentNonStrikerId,
      currentBowlerId,
      batsmanRuns,
      batsmanBalls,
      batsmanFours,
      batsmanSixes,
      batsmanDismissal,
      bowlerRuns,
      bowlerBalls,
      bowlerWickets,
      bowlerWides,
      bowlerNoBalls,
      extrasWides,
      extrasNoBalls,
      extrasByes,
      extrasLegByes,
      totalExtras: extrasWides + extrasNoBalls + extrasByes + extrasLegByes,
      currentOverDeliveries
    };
  };

  const formatBowlerOvers = (balls: number) => {
    return `${Math.floor(balls / 6)}.${balls % 6}`;
  };

  const calculateBattingSR = (runs: number, balls: number) => {
    if (balls === 0) return '0.00';
    return ((runs / balls) * 100).toFixed(2);
  };

  const calculateBowlerEcon = (runs: number, balls: number) => {
    if (balls === 0) return '0.00';
    const overs = balls / 6;
    return (runs / overs).toFixed(2);
  };

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

  const finalMatch = matches.find(m => m.stage === 'Final');
  const isTournamentEnded = finalMatch?.status === 'Completed';
  const championTeam = finalMatch ? teams.find(t => t.id === finalMatch.winner) : null;

  const getCapWinners = () => {
    const runsMap: Record<string, number> = {};
    const wicketsMap: Record<string, number> = {};
    const fieldingMap: Record<string, number> = {};

    allDeliveries.forEach((d) => {
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

    const getTop = (map: Record<string, number>) => {
      const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
      if (sorted.length === 0) return null;
      const [pId, val] = sorted[0];
      const player = players.find(p => p.id === pId);
      return player ? { player, value: val, team: teams.find(t => t.id === player.team) } : null;
    };

    return {
      orange: getTop(runsMap),
      purple: getTop(wicketsMap),
      fielder: getTop(fieldingMap)
    };
  };

  const getPlayerStatsMap = () => {
    const statsMap: Record<string, any> = {};
    players.forEach(p => {
      statsMap[p.id] = {
        batting: { inningsCount: 0, runs: 0, balls: 0, fours: 0, sixes: 0, outs: 0, avg: '0.00', sr: '0.05', inningsSet: new Set() },
        bowling: { inningsCount: 0, balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0, avg: 'N/A', econ: '0.00', oversStr: '0.0', inningsSet: new Set() }
      };
    });

    allDeliveries.forEach(d => {
      const deliveryInning = allInnings.find(i => i.id === d.inning);
      const deliveryMatch = deliveryInning ? matches.find(m => m.id === deliveryInning.match) : null;
      const isSpecialExtras = deliveryMatch?.special_extras || false;

      const runs = d.runs || 0;
      const isWide = d.extra_type === 'Wide';
      const isNoBall = d.extra_type === 'No Ball';
      const isLegal = isSpecialExtras ? true : (!isWide && !isNoBall);

      if (d.striker && statsMap[d.striker]) {
        const stats = statsMap[d.striker].batting;
        stats.inningsSet.add(d.inning);
        if (!isWide) {
          const runOffBat = d.runs_off_bat !== undefined && d.runs_off_bat !== null
            ? d.runs_off_bat
            : (isNoBall ? (isSpecialExtras ? Math.max(0, runs - 6) : Math.max(0, runs - 1)) : runs);
          stats.runs += runOffBat;
          stats.balls += 1;
          if (runOffBat === 4) stats.fours += 1;
          if (runOffBat === 6) stats.sixes += 1;
        }
        if (d.is_wicket && d.out_player === d.striker) {
          stats.outs += 1;
        }
      }

      if (d.bawler && statsMap[d.bawler]) {
        const stats = statsMap[d.bawler].bowling;
        stats.inningsSet.add(d.inning);
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
        statsMap[d.out_player].batting.inningsSet.add(d.inning);
      }
    });

    Object.keys(statsMap).forEach(pId => {
      const stats = statsMap[pId];
      stats.batting.inningsCount = stats.batting.inningsSet.size;
      const batOuts = stats.batting.outs;
      const batRuns = stats.batting.runs;
      const batBalls = stats.batting.balls;
      stats.batting.avg = batOuts === 0 ? (batRuns > 0 ? `${batRuns}*` : '0.00') : (batRuns / batOuts).toFixed(2);
      stats.batting.sr = batBalls === 0 ? '0.00' : ((batRuns / batBalls) * 100).toFixed(2);

      stats.bowling.inningsCount = stats.bowling.inningsSet.size;
      const bowlBalls = stats.bowling.balls;
      const bowlRuns = stats.bowling.runs;
      const bowlWkts = stats.bowling.wickets;
      stats.bowling.avg = bowlWkts === 0 ? 'N/A' : (bowlRuns / bowlWkts).toFixed(2);
      stats.bowling.econ = bowlBalls === 0 ? '0.00' : (bowlRuns / (bowlBalls / 6)).toFixed(2);
      stats.bowling.oversStr = `${Math.floor(bowlBalls / 6)}.${bowlBalls % 6}`;
    });

    return statsMap;
  };

  const renderCapTooltip = (_pId: string, capType: string, stats: any) => {
    const isBowling = capType.includes('Purple');
    if (isBowling) {
      return (
        <div className="absolute bottom-[105%] left-1/2 -translate-x-1/2 mb-1 w-56 p-3.5 bg-slate-950/98 border border-slate-800 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-200 z-50 backdrop-blur-md text-left space-y-2">
          <div className="text-[10px] font-black uppercase text-violet-400 tracking-wider border-b border-slate-900 pb-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-violet-400" />
            <span>Bowling Statistics</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] font-sans">
            <div>
              <span className="text-slate-500 font-semibold block">Innings:</span>
              <span className="text-slate-300 font-bold">{stats.bowling.inningsCount}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Overs:</span>
              <span className="text-slate-300 font-bold">{stats.bowling.oversStr}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Wickets:</span>
              <span className="text-emerald-400 font-black">{stats.bowling.wickets}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Economy:</span>
              <span className="text-slate-300 font-bold">{stats.bowling.econ}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Runs:</span>
              <span className="text-slate-300 font-bold">{stats.bowling.runs}</span>
            </div>
            <div>
              <span className="text-slate-550 font-semibold block">Average:</span>
              <span className="text-slate-300 font-bold">{stats.bowling.avg}</span>
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
        <div className="absolute bottom-[105%] left-1/2 -translate-x-1/2 mb-1 w-56 p-3.5 bg-slate-950/98 border border-slate-800 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-200 z-50 backdrop-blur-md text-left space-y-2">
          <div className="text-[10px] font-black uppercase text-amber-400 tracking-wider border-b border-slate-900 pb-1 flex items-center gap-1">
            <Flame className="w-3 h-3 text-amber-400" />
            <span>Batting Statistics</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] font-sans">
            <div>
              <span className="text-slate-500 font-semibold block">Innings:</span>
              <span className="text-slate-300 font-bold">{stats.batting.inningsCount}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Total Runs:</span>
              <span className="text-emerald-400 font-black">{stats.batting.runs}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Average:</span>
              <span className="text-slate-300 font-bold">{stats.batting.avg}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Strike Rate:</span>
              <span className="text-slate-300 font-bold">{stats.batting.sr}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Balls faced:</span>
              <span className="text-slate-300 font-bold">{stats.batting.balls}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Outs:</span>
              <span className="text-slate-300 font-bold">{stats.batting.outs}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Fours (4s):</span>
              <span className="text-slate-300 font-bold">{stats.batting.fours}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Sixes (6s):</span>
              <span className="text-slate-300 font-bold">{stats.batting.sixes}</span>
            </div>
          </div>
        </div>
      );
    }
  };

  const renderCommentaryText = (d: Delivery) => {
    const runs = d.runs || 0;
    const deliveryInning = allInnings.find(i => i.id === d.inning);
    const deliveryMatch = deliveryInning ? matches.find(m => m.id === deliveryInning.match) : null;
    const isSpecialExtras = deliveryMatch?.special_extras || false;

    if (d.is_wicket) {
      const fielderName = d.fielder ? getPlayer(d.fielder)?.name : '';
      let msg = '';

      if (d.dismissal_type === 'Bawled') {
        msg = 'OUT! Bowled clean!';
      } else if (d.dismissal_type === 'Catch') {
        msg = `OUT! Caught by ${fielderName || 'fielder'}.`;
      } else if (d.dismissal_type === 'Run Out') {
        const isWide = d.extra_type === 'Wide';
        const isNoBall = d.extra_type === 'No Ball';
        const completedRuns = isSpecialExtras
          ? (isWide ? Math.max(0, runs - 4) : (isNoBall ? Math.max(0, runs - 6) : runs))
          : (isWide || isNoBall ? Math.max(0, runs - 1) : runs);

        msg = `OUT! Run out by ${fielderName || 'fielder'}.`;
        if (completedRuns > 0) {
          const runOffBat = d.runs_off_bat !== undefined && d.runs_off_bat !== null ? d.runs_off_bat : 0;
          if (isNoBall) {
            if (runOffBat > 0) {
              msg += ` ${completedRuns} run${completedRuns === 1 ? '' : 's'} completed off bat.`;
            } else {
              msg += ` ${completedRuns} bye${completedRuns === 1 ? '' : 's'} completed.`;
            }
          } else if (isWide || d.extra_type === 'Bye' || d.extra_type === 'Leg Bye') {
            msg += ` ${completedRuns} bye${completedRuns === 1 ? '' : 's'} completed.`;
          } else {
            msg += ` ${completedRuns} run${completedRuns === 1 ? '' : 's'} completed.`;
          }
        }
      } else if (d.dismissal_type === 'Stumped') {
        msg = `OUT! Stumped by ${fielderName || 'fielder'}.`;
      } else if (d.dismissal_type === 'Hit Wicket') {
        msg = 'OUT! Hit Wicket.';
      } else if (d.dismissal_type === 'Retired Out') {
        msg = 'OUT! Retired Out.';
      } else {
        msg = 'OUT!';
      }

      // Show how many runs were scored on this wicket delivery in Special Extras mode
      if (isSpecialExtras && (d.extra_type === 'Wide' || d.extra_type === 'No Ball')) {
        const penalty = d.extra_type === 'Wide' ? 4 : 6;
        const completedRuns = d.extra_type === 'Wide' ? Math.max(0, runs - 4) : Math.max(0, runs - 6);
        if (completedRuns > 0) {
          msg += ` ${runs} run${runs === 1 ? '' : 's'} scored (${penalty} penalty + ${completedRuns} completed).`;
        } else {
          msg += ` ${runs} run${runs === 1 ? '' : 's'} scored (${penalty} penalty runs).`;
        }
      }

      if (d.extra_type !== 'None') {
        msg += ` (${d.extra_type})`;
      }
      return msg;
    }

    if (d.is_extra) {
      if (d.extra_type === 'Wide') {
        const baseWide = isSpecialExtras ? 4 : 1;
        const completed = runs - baseWide;
        return isSpecialExtras
          ? (completed > 0
            ? `Wide. Batters ran ${completed} bye(s) (${runs} runs total, counted as legal ball).`
            : `Wide (4 runs, counted as legal ball).`)
          : (completed > 0
            ? `Wide. Batters ran ${completed} bye(s) (${runs} runs total).`
            : `Wide. 1 run total.`);
      } else if (d.extra_type === 'No Ball') {
        const baseNB = isSpecialExtras ? 6 : 1;
        const completed = runs - baseNB;
        const runOffBat = d.runs_off_bat !== undefined && d.runs_off_bat !== null
          ? d.runs_off_bat
          : (isSpecialExtras ? Math.max(0, runs - 6) : Math.max(0, runs - 1));

        if (isSpecialExtras) {
          if (completed > 0) {
            if (runOffBat > 0) {
              return `No Ball. Batsman scored ${runOffBat} run(s) off bat (${runs} runs total, counted as legal ball).`;
            } else {
              return `No Ball. Batters ran ${completed} bye(s) (${runs} runs total, counted as legal ball).`;
            }
          } else {
            return `No Ball (6 runs, counted as legal ball).`;
          }
        } else {
          if (completed > 0) {
            if (runOffBat > 0) {
              return `No Ball. Batsman scored ${runOffBat} run(s) off bat (${runs} runs total).`;
            } else {
              return `No Ball. Batters ran ${completed} bye(s) (${runs} runs total).`;
            }
          } else {
            return `No Ball. 1 run total.`;
          }
        }
      } else if (d.extra_type === 'Bye') {
        return `Bye. ${runs} run(s).`;
      } else if (d.extra_type === 'Leg Bye') {
        return `Leg Bye. ${runs} run(s).`;
      }
    }

    if (runs === 6) {
      return '6 runs! Massive strike over the boundary ropes!';
    } else if (runs === 4) {
      return '4 runs! Cracking shot races away to the boundary!';
    } else if (runs === 0) {
      return 'No run. Solid defensive play.';
    }
    return `${runs} run(s) scored.`;
  };

  // Filtered Matches List
  const filteredMatches = matches.filter(m => {
    if (filterTab === 'all') return true;
    return m.status.toLowerCase() === filterTab.toLowerCase();
  });

  // Render a mini-score summary for a match card
  const renderCardScore = (match: Match) => {
    const t1 = getTeam(match.team1);
    const t2 = getTeam(match.team2);
    const matchInnings = allInnings.filter(i => i.match === match.id);
    const dynamicWinner = getMatchWinner(match, matchInnings, allDeliveries);
    const winner = getTeam(match.winner) || dynamicWinner;
    const activeInning = match.status === 'Live' && matchInnings.length > 0
      ? matchInnings[matchInnings.length - 1]
      : null;
    const battingTeamId = activeInning ? activeInning.batting_team : '';
    const isT1Batting = battingTeamId === t1?.id;
    const isT2Batting = battingTeamId === t2?.id;

    const getTeamScoreText = (teamId: string) => {
      if (!teamId) return null;
      const inningOfTeam = matchInnings.find(i => i.batting_team === teamId);
      if (!inningOfTeam) return null;
      const state = getInningState(inningOfTeam, allDeliveries);
      return (
        <span className="font-extrabold text-slate-100 text-xs">
          {state.totalRuns}/{state.totalWickets} <span className="text-slate-400 font-normal">({state.oversStr}/{match.overs_limit || 5} ov)</span>
        </span>
      );
    };

    const getRecentBallsForCard = () => {
      if ((match.status !== 'Live' && match.status !== 'Completed') || matchInnings.length === 0) return null;
      const activeInn = matchInnings[matchInnings.length - 1];
      const innDels = allDeliveries.filter(d => d.inning === activeInn.id);
      if (innDels.length === 0) return null;

      const state = getInningState(activeInn, allDeliveries);
      const isComplete = match.status === 'Completed' || state.totalWickets >= 10 || state.totalBalls >= (match.overs_limit || 5) * 6;
      const tickerItems = getRecentBallsTicker(innDels, isComplete).slice(-10); // Show up to 10 items on the card to fit cleanly
      return (
        <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-slate-900/60 shrink-0 overflow-hidden">
          <span className="text-[8px] text-slate-500 font-black uppercase tracking-wider shrink-0 mr-1">Recent:</span>
          <DragScrollContainer className="gap-1.5 py-0 flex-1">
            {tickerItems.map((item) => {
              if (item.type === 'over-divider') {
                return (
                  <div key={item.id} className="px-1.5 border-l border-r border-slate-800 text-[8px] text-slate-400 font-bold shrink-0 flex flex-col items-center justify-center">
                    <span className="text-[7px] text-slate-500 font-bold leading-none">{item.label}</span>
                    <span className="text-[7px] text-emerald-400 font-extrabold leading-none mt-0.5">{item.overRuns} R</span>
                  </div>
                );
              }
              return (
                <div key={item.id} className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-extrabold shrink-0 ${item.badgeClass}`}>
                  {item.label}
                </div>
              );
            })}
          </DragScrollContainer>
        </div>
      );
    };

    return (
      <div className="flex flex-col gap-2.5 mt-3 bg-slate-950/20 p-3 rounded-xl border border-slate-900/40">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${isT1Batting ? 'bg-emerald-400 animate-pulse' : 'bg-slate-650'}`} />
            {t1 && getTeamLogo(t1) && (
              <img
                src={getTeamLogo(t1)}
                alt=""
                className="w-5 h-5 rounded-md object-cover border border-slate-800"
              />
            )}
            <span className={`font-semibold transition-all ${isT1Batting
                ? 'text-sm font-extrabold text-emerald-400'
                : (match.status === 'Completed' || dynamicWinner) && winner?.id !== t1?.id
                  ? 'text-slate-500 line-through'
                  : 'text-slate-200'
              }`}>
              {t1?.name || 'TBD'} {isT1Batting && '🏏'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {getTeamScoreText(match.team1)}
            {(match.status === 'Completed' || dynamicWinner) && winner?.id === t1?.id && (
              <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">WINNER</span>
            )}
          </div>
        </div>
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${isT2Batting ? 'bg-emerald-400 animate-pulse' : 'bg-slate-650'}`} />
            {t2 && getTeamLogo(t2) && (
              <img
                src={getTeamLogo(t2)}
                alt=""
                className="w-5 h-5 rounded-md object-cover border border-slate-800"
              />
            )}
            <span className={`font-semibold transition-all ${isT2Batting
                ? 'text-sm font-extrabold text-emerald-400'
                : (match.status === 'Completed' || dynamicWinner) && winner?.id !== t2?.id
                  ? 'text-slate-500 line-through'
                  : 'text-slate-200'
              }`}>
              {t2?.name || 'TBD'} {isT2Batting && '🏏'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {getTeamScoreText(match.team2)}
            {(match.status === 'Completed' || dynamicWinner) && winner?.id === t2?.id && (
              <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">WINNER</span>
            )}
          </div>
        </div>
        {match.status === 'Live' && matchInnings.length >= 2 && matchInnings.length % 2 === 0 && (() => {
          const isSO = matchInnings.length > 2;
          const firstInningState = getInningState(matchInnings[matchInnings.length - 2], allDeliveries);
          const secondInningState = getInningState(matchInnings[matchInnings.length - 1], allDeliveries);
          const target = firstInningState.totalRuns + 1;
          const runsNeeded = target - secondInningState.totalRuns;
          if (runsNeeded <= 0) return null; // Hide if target is chased!
          const oversLimitVal = isSO ? 1 : (match.overs_limit || 5);
          const maxBalls = oversLimitVal * 6;
          const ballsRemaining = Math.max(0, maxBalls - secondInningState.totalBalls);
          const oversRemainingStr = `${Math.floor(ballsRemaining / 6)}.${ballsRemaining % 6}`;

          return (
            <div className="mt-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20 flex flex-wrap items-center justify-between gap-2">
              <span>🎯 {isSO ? 'SO ' : ''}Target: <span className="font-extrabold text-white">{target}</span></span>
              <span>Need {runsNeeded} runs from {ballsRemaining} balls ({oversRemainingStr} ov)</span>
            </div>
          );
        })()}
        {getRecentBallsForCard()}
      </div>
    );
  };

  // Simulation calculations for active hero scorecard
  const liveInnings = liveMatch ? allInnings.filter(i => i.match === liveMatch.id) : [];
  const liveDeliveries = liveMatch ? allDeliveries.filter(d => liveInnings.some(i => i.id === d.inning)) : [];
  const activeInning = liveInnings[liveInnings.length - 1];
  const activeInningState = activeInning ? getInningState(activeInning, liveDeliveries) : null;
  const battingTeam = activeInning ? getTeam(activeInning.batting_team) : null;
  const isTeam1Batting = liveMatch && activeInning && activeInning.batting_team === liveMatch.team1;
  const isTeam2Batting = liveMatch && activeInning && activeInning.batting_team === liveMatch.team2;
  
  const t1Inning = liveMatch ? liveInnings.find(i => i.batting_team === liveMatch.team1) : null;
  const t1InningState = t1Inning ? getInningState(t1Inning, liveDeliveries) : null;
  const t2Inning = liveMatch ? liveInnings.find(i => i.batting_team === liveMatch.team2) : null;
  const t2InningState = t2Inning ? getInningState(t2Inning, liveDeliveries) : null;

  const isSuperOver = liveInnings.length > 2;
  const t1SuperInnings = liveMatch ? liveInnings.slice(2).filter(i => i.batting_team === liveMatch.team1) : [];
  const t2SuperInnings = liveMatch ? liveInnings.slice(2).filter(i => i.batting_team === liveMatch.team2) : [];
  const t1SuperInning = t1SuperInnings[t1SuperInnings.length - 1];
  const t2SuperInning = t2SuperInnings[t2SuperInnings.length - 1];
  const t1SuperInningState = t1SuperInning ? getInningState(t1SuperInning, liveDeliveries) : null;
  const t2SuperInningState = t2SuperInning ? getInningState(t2SuperInning, liveDeliveries) : null;

  const dynamicWinner = liveMatch ? getMatchWinner(liveMatch, liveInnings, liveDeliveries) : null;
  const secondInning = liveInnings[1];
  const isSecondInning = liveInnings.length >= 2 && liveInnings.length % 2 === 0;
  const secondInningState = secondInning ? getInningState(secondInning, liveDeliveries) : null;
  
  const oversLimit = isSuperOver ? 1 : (liveMatch?.overs_limit || 5);
  const isVotingLocked = isSuperOver || (isSecondInning && secondInningState && secondInningState.totalBalls >= (liveMatch?.overs_limit || 5) * 3);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-12">

      {/* ----------------- TOURNAMENT CHAMPIONS BANNER ----------------- */}
      {isTournamentEnded && championTeam && (() => {
        const caps = getCapWinners();
        const statsMap = getPlayerStatsMap();

        return (
          <div className="space-y-6 animate-fade-in relative overflow-visible">
            {/* Confetti ambient glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 via-yellow-450 to-violet-550 rounded-3xl blur-[12px] opacity-25 pointer-events-none animate-pulse-slow" />

            <div className="glass-panel rounded-3xl border-2 border-amber-500/40 p-6 md:p-8 neon-glow-amber relative overflow-visible text-center">
              {/* Gold Crown Trophy Banner */}
              <div className="flex flex-col items-center justify-center space-y-2.5">
                <div className="p-4 bg-gradient-to-tr from-amber-500/20 to-yellow-450/20 border border-amber-400/40 rounded-full text-amber-400 shadow-xl shadow-amber-500/10 scale-110">
                  <Trophy className="w-12 h-12" />
                </div>
                <div>
                  <span className="text-[10px] bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black tracking-widest px-3 py-1 rounded-full uppercase block mx-auto max-w-fit shadow-md">
                    Tournament Completed
                  </span>
                  <h2 className="text-2xl font-black bg-gradient-to-r from-amber-450 via-yellow-200 to-violet-400 bg-clip-text text-transparent tracking-tight mt-2.5">
                    CONGRATULATIONS CHAMPIONS!
                  </h2>
                </div>
              </div>

              {/* Champion Team details */}
              <div className="mt-6 flex flex-col items-center justify-center space-y-3 pb-6 border-b border-slate-800/80">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-850 flex items-center justify-center font-black text-3xl text-slate-100 border-2 border-amber-500/40 shadow-2xl">
                  <img src={getTeamLogo(championTeam)} className="w-full h-full object-cover rounded-xl" alt="" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-slate-100">{championTeam.name}</h3>
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Tournament Winner 2026</span>
                </div>
              </div>

              {/* Man of the Series Accolade */}
              {tournamentConfig && tournamentConfig.man_of_the_series && (() => {
                const mosPlayer = tournamentConfig.expand?.man_of_the_series;
                if (!mosPlayer) return null;
                const mosTeam = teams.find(t => t.id === mosPlayer.team);
                return (
                  <div className="mt-6 py-6 border-b border-slate-800/80 flex flex-col items-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/25 text-amber-400 font-black text-[10px] rounded-full uppercase tracking-wider mb-4">
                      <Medal className="w-3.5 h-3.5" />
                      Man of the Series
                    </div>

                    <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-amber-500/20 max-w-lg w-full bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left relative overflow-hidden">
                      {/* Decorative subtle ambient glow inside card */}
                      <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />

                      {/* Player photo or fallback */}
                      <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden shadow-lg">
                        {mosPlayer.photo ? (
                          <img src={getFileUrl('players', mosPlayer.id, mosPlayer.photo)} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <User className="w-8 h-8 text-slate-500" />
                        )}
                      </div>

                      <div className="space-y-1 w-full">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                          <h4 className="text-base font-extrabold text-slate-100 uppercase tracking-tight">{mosPlayer.name}</h4>
                          {mosTeam && (
                            <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              {mosTeam.name}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{mosPlayer.role}</p>
                        {tournamentConfig.mos_performance && (
                          <p className="text-xs text-slate-350 italic font-medium leading-relaxed mt-2 border-t border-slate-800/45 pt-2">
                            "{tournamentConfig.mos_performance}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Caps Winners Showcase */}
              <div className="mt-6">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-4">
                  🏆 Individual Caps & Award Winners
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 overflow-visible">
                  {/* Orange Cap */}
                  {caps.orange && (() => {
                    const entry = caps.orange;
                    const photo = entry.player.photo ? getFileUrl('players', entry.player.id, entry.player.photo) : '';
                    const stats = statsMap[entry.player.id];
                    return (
                      <div className="relative group/tooltip bg-slate-950/50 border border-amber-500/20 p-4 rounded-xl text-center flex flex-col items-center hover:border-amber-400 transition-colors overflow-visible">
                        <span className="text-[8px] bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          🟠 Orange Cap Winner
                        </span>
                        <div className="relative w-12 h-12 my-2.5">
                          {photo ? (
                            <img src={photo} className="w-full h-full rounded-full object-cover border border-amber-500/50" alt="" />
                          ) : (
                            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-800">
                              {entry.player.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-black text-slate-200">{formatPlayerName(entry.player)}</span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase">{entry.team?.short_name || 'TBD'}</span>
                        <div className="mt-2 text-xs font-extrabold text-amber-400 bg-amber-500/5 px-2.5 py-0.5 rounded border border-amber-550/15">
                          {entry.value} Runs
                        </div>
                        {stats && renderCapTooltip(entry.player.id, 'Orange Cap', stats)}
                      </div>
                    );
                  })()}

                  {/* Purple Cap */}
                  {caps.purple && (() => {
                    const entry = caps.purple;
                    const photo = entry.player.photo ? getFileUrl('players', entry.player.id, entry.player.photo) : '';
                    const stats = statsMap[entry.player.id];
                    return (
                      <div className="relative group/tooltip bg-slate-950/50 border border-violet-500/20 p-4 rounded-xl text-center flex flex-col items-center hover:border-violet-400 transition-colors overflow-visible">
                        <span className="text-[8px] bg-violet-500/10 text-violet-300 font-bold border border-violet-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          🟣 Purple Cap Winner
                        </span>
                        <div className="relative w-12 h-12 my-2.5">
                          {photo ? (
                            <img src={photo} className="w-full h-full rounded-full object-cover border border-violet-500/50" alt="" />
                          ) : (
                            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-800">
                              {entry.player.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-black text-slate-200">{formatPlayerName(entry.player)}</span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase">{entry.team?.short_name || 'TBD'}</span>
                        <div className="mt-2 text-xs font-extrabold text-violet-400 bg-violet-500/5 px-2.5 py-0.5 rounded border border-violet-550/15">
                          {entry.value} Wickets
                        </div>
                        {stats && renderCapTooltip(entry.player.id, 'Purple Cap', stats)}
                      </div>
                    );
                  })()}

                  {/* Best Fielder */}
                  {caps.fielder && (() => {
                    const entry = caps.fielder;
                    const photo = entry.player.photo ? getFileUrl('players', entry.player.id, entry.player.photo) : '';
                    const stats = statsMap[entry.player.id];
                    return (
                      <div className="relative group/tooltip bg-slate-950/50 border border-emerald-500/20 p-4 rounded-xl text-center flex flex-col items-center hover:border-emerald-400 transition-colors overflow-visible">
                        <span className="text-[8px] bg-emerald-500/10 text-emerald-300 font-bold border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          🟢 Best Fielder Winner
                        </span>
                        <div className="relative w-12 h-12 my-2.5">
                          {photo ? (
                            <img src={photo} className="w-full h-full rounded-full object-cover border border-emerald-500/50" alt="" />
                          ) : (
                            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-800">
                              {entry.player.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-black text-slate-200">{formatPlayerName(entry.player)}</span>
                        <span className="text-[9px] text-slate-555 font-bold uppercase">{entry.team?.short_name || 'TBD'}</span>
                        <div className="mt-2 text-xs font-extrabold text-emerald-450 bg-emerald-500/5 px-2.5 py-0.5 rounded border border-emerald-555/15">
                          {entry.value} Outs
                        </div>
                        {stats && renderCapTooltip(entry.player.id, 'Best Fielder', stats)}
                      </div>
                    );
                  })()}
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ----------------- 1. LIVE HERO MATCH BANNER ----------------- */}
      {liveMatch && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
              <span className="w-2 h-2 rounded-full bg-rose-500 pulse-fast" />
              LIVE MATCH
            </span>
            {isSuperOver && (
              <span className="flex items-center gap-1.5 text-xs font-black text-amber-350 bg-amber-500/15 px-3 py-1 rounded-full border border-amber-500/30 animate-pulse shrink-0">
                💥 SUPER OVER
              </span>
            )}
            <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">
              {liveMatch.stage}
            </span>
            {liveMatch.match_time && (
              <span className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800/80">
                <Clock className="w-3 h-3 text-emerald-500/80" />
                <span>{formatMatchTime(liveMatch.match_time)}</span>
              </span>
            )}
          </div>

          <div
            onClick={() => setSelectedPopupMatch(liveMatch)}
            className="glass-panel rounded-3xl border border-slate-800/80 p-6 md:p-8 neon-glow-emerald relative overflow-hidden cursor-pointer hover:border-emerald-500/30 transition-all duration-300"
          >
            <div className="absolute -right-24 -top-24 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Live Card Highlight Overlay */}
            <AnimatePresence>
              {showHighlight && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 z-40 rounded-3xl"
                >
                  <motion.div 
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ type: 'spring', damping: 12 }}
                    className="text-center space-y-2 px-6"
                  >
                    <motion.div 
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      className="text-5xl"
                    >
                      {showHighlight === 'Wicket' ? '☝️' : showHighlight === 'Four' ? '🔥' : '🚀'}
                    </motion.div>
                    <h2 className={`text-5xl font-black tracking-widest uppercase ${
                      showHighlight === 'Wicket' ? 'text-rose-500' : showHighlight === 'Four' ? 'text-emerald-400' : 'text-violet-400'
                    }`}>
                      {showHighlight === 'Wicket' ? 'OUT!' : showHighlight === 'Four' ? 'FOUR!' : 'SIX!'}
                    </h2>
                    <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">
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
                      const matchInnings = allInnings.filter(i => i.match === liveMatch.id);
                      const activeInning = matchInnings[matchInnings.length - 1];
                      if (activeInning) {
                        activeTeamId = activeInning.batting_team;
                        const teamObj = teams.find(t => t.id === activeTeamId);
                        if (teamObj) battingTeamName = teamObj.name;
                      }
                      
                      const tournamentCount = allDeliveries.filter(d => d.runs_off_bat === targetRuns).length;
                      const teamCount = activeTeamId 
                        ? allDeliveries.filter(d => inningBattingTeamMap.get(d.inning) === activeTeamId && d.runs_off_bat === targetRuns).length 
                        : 0;

                      return (
                        <div className="mt-4 pt-3 border-t border-slate-800/80 w-full max-w-[240px] text-center space-y-2 mx-auto">
                          <div className="flex items-center justify-between text-[10px] uppercase font-extrabold tracking-wider">
                            <span className="text-slate-500">Tournament Total:</span>
                            <span className={isSix ? 'text-violet-400 font-black' : 'text-emerald-450 font-black'}>
                              {tournamentCount}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] uppercase font-extrabold tracking-wider">
                            <span className="text-slate-500 truncate max-w-[150px]">{battingTeamName} Total:</span>
                            <span className={isSix ? 'text-violet-400 font-black' : 'text-emerald-450 font-black'}>
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

            {/* Pulsing warning banner for play suspension */}
            {liveMatch.delay_reason && (
              <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl p-3.5 mb-6 flex items-center justify-between gap-3 text-amber-300 animate-pulse relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                    {liveMatch.delay_reason.toLowerCase().includes('rain') ? (
                      <CloudRain className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-455 block">Play Suspended</span>
                    <span className="text-xs font-bold text-slate-200 mt-0.5 block">{liveMatch.delay_reason}</span>
                  </div>
                </div>
                <span className="text-[9px] font-black tracking-widest uppercase bg-amber-500/25 px-2.5 py-1 rounded border border-amber-500/30 shrink-0">
                  Suspended
                </span>
              </div>
            )}

            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-800/60">
              <div className="flex flex-col items-center md:flex-row md:items-center gap-3 md:gap-4 w-full md:w-auto justify-center md:justify-start text-center md:text-left">
                {getTeam(liveMatch.team1) && getTeamLogo(getTeam(liveMatch.team1)) ? (
                  <img
                    src={getTeamLogo(getTeam(liveMatch.team1))}
                    alt={getTeam(liveMatch.team1)?.short_name}
                    className={`w-12 h-12 rounded-2xl object-cover transition-all ${isTeam1Batting
                        ? 'border-2 border-emerald-500 shadow-md shadow-emerald-500/10 scale-105'
                        : 'border border-slate-800'
                      }`}
                  />
                ) : (
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 flex items-center justify-center font-black text-lg transition-all ${isTeam1Batting
                      ? 'text-emerald-400 border-2 border-emerald-500/50 shadow-md shadow-emerald-500/10 scale-105'
                      : 'text-slate-250 border border-slate-850'
                    }`}>
                    {getTeam(liveMatch.team1)?.short_name || 'T1'}
                  </div>
                )}
                <div>
                  <h3 className={`font-bold transition-all ${dynamicWinner
                      ? (dynamicWinner.id === liveMatch.team1
                        ? 'text-lg md:text-xl font-black text-emerald-400'
                        : 'text-md text-slate-500 line-through')
                      : (isTeam1Batting
                        ? 'text-lg md:text-xl font-black text-emerald-400'
                        : 'text-md text-slate-200')
                    }`}>
                    {getTeam(liveMatch.team1)?.name} {isTeam1Batting && !dynamicWinner && '🏏'}
                  </h3>
                  {t1InningState && (
                    <div className={`text-xs mt-1.5 font-bold ${isTeam1Batting && !dynamicWinner ? 'text-emerald-400/85' : 'text-slate-400'}`}>
                      Score: {t1InningState.totalRuns}/{t1InningState.totalWickets} ({t1InningState.oversStr}/{liveMatch.overs_limit || 5} ov)
                    </div>
                  )}
                  {t1SuperInningState && (
                    <div className="text-[10px] mt-1 font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg inline-block">
                      Super Over: {t1SuperInningState.totalRuns}/{t1SuperInningState.totalWickets} ({t1SuperInningState.oversStr}/1 ov)
                    </div>
                  )}
                </div>
              </div>

              <div className="text-center py-2.5 px-6 rounded-2xl bg-slate-950/50 border border-slate-900 min-w-[160px]">
                {activeInningState ? (
                  <>
                    <div className="text-2xl font-black text-emerald-400 tracking-tight flex items-center justify-center gap-1.5 overflow-hidden h-8">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={activeInningState.totalRuns}
                          initial={{ y: -15, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: 15, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                          className="inline-block animate-fadeIn"
                        >
                          {activeInningState.totalRuns}
                        </motion.span>
                      </AnimatePresence>
                      <span>/</span>
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={activeInningState.totalWickets}
                          initial={{ y: -15, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: 15, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                          className="inline-block animate-fadeIn"
                        >
                          {activeInningState.totalWickets}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                    <div className="text-xs text-slate-400 font-semibold mt-1 flex items-center justify-center gap-1 overflow-hidden h-4">
                      <span>Overs:</span>
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={activeInningState.oversStr}
                          initial={{ y: -10, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: 10, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="inline-block"
                        >
                          {activeInningState.oversStr}
                        </motion.span>
                      </AnimatePresence>
                      <span>/ {oversLimit}</span>
                    </div>
                    {dynamicWinner ? (
                      <span className="inline-block text-[10px] text-amber-400 font-black uppercase tracking-wider mt-1.5 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20 animate-bounce">
                        🏆 {dynamicWinner.short_name} WON!
                      </span>
                    ) : (
                      battingTeam && (
                        <span className="inline-block text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
                          {battingTeam.short_name} batting
                        </span>
                      )
                    )}
                  </>
                ) : (
                  <div className="text-xs font-semibold text-slate-400 py-3">Preparing Match Details</div>
                )}
              </div>

              <div className="flex flex-col-reverse items-center md:flex-row md:items-center gap-3 md:gap-4 w-full md:w-auto justify-center md:justify-end text-center md:text-right">
                <div>
                  <h3 className={`font-bold transition-all ${dynamicWinner
                      ? (dynamicWinner.id === liveMatch.team2
                        ? 'text-lg md:text-xl font-black text-emerald-400'
                        : 'text-md text-slate-500 line-through')
                      : (isTeam2Batting
                        ? 'text-lg md:text-xl font-black text-emerald-400'
                        : 'text-md text-slate-200')
                    }`}>
                    {isTeam2Batting && !dynamicWinner && '🏏'} {getTeam(liveMatch.team2)?.name}
                  </h3>
                  {t2InningState && (
                    <div className={`text-xs mt-1.5 font-bold ${isTeam2Batting && !dynamicWinner ? 'text-emerald-400/85' : 'text-slate-400'}`}>
                      Score: {t2InningState.totalRuns}/{t2InningState.totalWickets} ({t2InningState.oversStr}/{liveMatch.overs_limit || 5} ov)
                    </div>
                  )}
                  {t2SuperInningState && (
                    <div className="text-[10px] mt-1 font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg inline-block">
                      Super Over: {t2SuperInningState.totalRuns}/{t2SuperInningState.totalWickets} ({t2SuperInningState.oversStr}/1 ov)
                    </div>
                  )}
                </div>
                {getTeam(liveMatch.team2) && getTeamLogo(getTeam(liveMatch.team2)) ? (
                  <img
                    src={getTeamLogo(getTeam(liveMatch.team2))}
                    alt={getTeam(liveMatch.team2)?.short_name}
                    className={`w-12 h-12 rounded-2xl object-cover transition-all ${isTeam2Batting
                        ? 'border-2 border-emerald-500 shadow-md shadow-emerald-500/10 scale-105'
                        : 'border border-slate-800'
                      }`}
                  />
                ) : (
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 flex items-center justify-center font-black text-lg transition-all ${isTeam2Batting
                      ? 'text-emerald-400 border-2 border-emerald-500/50 shadow-md shadow-emerald-500/10 scale-105'
                      : 'text-slate-250 border border-slate-850'
                    }`}>
                    {getTeam(liveMatch.team2)?.short_name || 'T2'}
                  </div>
                )}
              </div>
            </div>

            {/* Chasing Status Banner */}
            {isSecondInning && (() => {
              const firstInningState = getInningState(liveInnings[liveInnings.length - 2], liveDeliveries);
              const secondInningState = getInningState(liveInnings[liveInnings.length - 1], liveDeliveries);
              const target = firstInningState.totalRuns + 1;
              const runsNeeded = target - secondInningState.totalRuns;
              if (runsNeeded <= 0) return null; // Hide if target is chased!
              const targetOversLimit = isSuperOver ? 1 : (liveMatch.overs_limit || 5);
              const maxBalls = targetOversLimit * 6;
              const ballsRemaining = Math.max(0, maxBalls - secondInningState.totalBalls);
              const oversRemainingStr = `${Math.floor(ballsRemaining / 6)}.${ballsRemaining % 6}`;
              const chasingTeam = getTeam(liveInnings[liveInnings.length - 1].batting_team);

              return (
                <div className="mt-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center text-xs font-semibold text-emerald-300 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 shadow-sm shadow-emerald-500/5">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] bg-emerald-500 text-slate-950 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                      {isSuperOver ? 'SO Target' : 'Target'}
                    </span>
                    <span className="font-extrabold text-white text-sm">{target}</span>
                  </div>
                  <div className="h-3 w-px bg-slate-800 hidden sm:block" />
                  <div>
                    {chasingTeam?.name} needs <span className="font-extrabold text-white text-sm">{runsNeeded}</span> runs from <span className="font-extrabold text-white text-sm">{ballsRemaining}</span> balls <span className="text-slate-400 font-normal">({oversRemainingStr} ov left)</span>
                  </div>
                </div>
              );
            })()}

            {/* Batsmen partnership preview */}
            {activeInningState && (
              <div className="mt-4 flex flex-col sm:flex-row justify-between gap-4 text-xs">
                <div className="flex flex-col gap-1.5">
                  {activeInningState.currentStrikerId && (
                    <span className="text-slate-300 font-medium">
                      🏏 {formatPlayerName(getPlayer(activeInningState.currentStrikerId))}:{' '}
                      <span className="font-extrabold text-emerald-400">
                        {activeInningState.batsmanRuns[activeInningState.currentStrikerId] || 0}
                      </span>
                      <span className="text-slate-500 font-normal ml-0.5">
                        ({activeInningState.batsmanBalls[activeInningState.currentStrikerId] || 0}b)
                      </span>
                    </span>
                  )}
                  {activeInningState.currentNonStrikerId && (
                    <span className="text-slate-400 font-normal ml-4">
                      {formatPlayerName(getPlayer(activeInningState.currentNonStrikerId))}:{' '}
                      <span className="font-semibold text-slate-300">
                        {activeInningState.batsmanRuns[activeInningState.currentNonStrikerId] || 0}
                      </span>
                      <span className="text-slate-500 font-normal ml-0.5">
                        ({activeInningState.batsmanBalls[activeInningState.currentNonStrikerId] || 0}b)
                      </span>
                    </span>
                  )}
                </div>

                {activeInningState.currentBowlerId && (
                  <div className="text-right sm:text-left">
                    <span className="text-slate-400 font-medium">
                      🥎 {formatPlayerName(getPlayer(activeInningState.currentBowlerId))}:{' '}
                      <span className="font-bold text-slate-300">
                        {activeInningState.bowlerWickets[activeInningState.currentBowlerId] || 0} - {activeInningState.bowlerRuns[activeInningState.currentBowlerId] || 0}
                      </span>
                      <span className="text-slate-500 font-normal ml-1">
                        ({formatBowlerOvers(activeInningState.bowlerBalls[activeInningState.currentBowlerId] || 0)} ov)
                      </span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Live Match Recent Balls Ticker */}
            {activeInning && (() => {
              const activeInningDeliveries = liveDeliveries.filter(d => d.inning === activeInning.id);
              if (activeInningDeliveries.length === 0) return null;
              const state = getInningState(activeInning, liveDeliveries);
              const isComplete = liveMatch.status === 'Completed' || dynamicWinner !== null || state.totalWickets >= 10 || state.totalBalls >= (liveMatch.overs_limit || 5) * 6;
              const tickerItems = getRecentBallsTicker(activeInningDeliveries, isComplete);
              return (
                <div className="mt-4 pt-4 border-t border-slate-800/40 space-y-2">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">Recent Deliveries:</span>
                  <DragScrollContainer>
                    {tickerItems.map((item) => {
                      if (item.type === 'over-divider') {
                        return (
                          <div key={item.id} className="flex flex-col items-center justify-center px-3 border-l border-r border-slate-800/80 shrink-0">
                            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">{item.label}</span>
                            <span className="text-[9px] text-slate-400 font-extrabold uppercase mt-0.5">{item.overRuns} RUNS</span>
                          </div>
                        );
                      }
                      return (
                        <div key={item.id} className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${item.badgeClass}`}>
                          {item.label}
                        </div>
                      );
                    })}
                  </DragScrollContainer>
                </div>
              );
            })()}

            {/* Voting Panel */}
            {liveMatch && (() => {
              const t1 = getTeam(liveMatch.team1);
              const t2 = getTeam(liveMatch.team2);
              if (!t1 || !t2) return null;

              const matchVotes = votes.filter(v => v.match === liveMatch.id);
              const votesT1 = matchVotes.filter(v => v.team === liveMatch.team1).length;
              const votesT2 = matchVotes.filter(v => v.team === liveMatch.team2).length;
              const totalVotes = votesT1 + votesT2;
              const pctT1 = totalVotes === 0 ? 50 : Math.round((votesT1 / totalVotes) * 100);
              const pctT2 = totalVotes === 0 ? 50 : 100 - pctT1;

              const hasVoted = localStorage.getItem(`voted_match_${liveMatch.id}`) !== null;
              const userVote = localStorage.getItem(`voted_match_${liveMatch.id}`);

              const handleVote = async (teamId: string) => {
                try {
                  await pb.collection('match_votes').create({
                    match: liveMatch.id,
                    team: teamId
                  });
                  localStorage.setItem(`voted_match_${liveMatch.id}`, teamId);
                  fetchAllTournamentDetails();
                } catch (err) {
                  console.error('Error saving vote:', err);
                }
              };

              return (
                <div className="mt-4 pt-4 border-t border-slate-800/40 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <span>Win Probability (Audience Poll)</span>
                    <span>{isVotingLocked ? '🔒 Voting Closed' : '🗳️ Live Voting'}</span>
                  </div>

                  {/* Percentage split bar */}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-400 w-10 text-left">{t1.short_name}</span>
                    <div className="flex-1 h-5 bg-slate-950 rounded-full overflow-hidden flex border border-slate-850">
                      <div 
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full flex items-center justify-start pl-3 text-[9px] font-black text-slate-950 transition-all duration-500"
                        style={{ width: `${pctT1}%` }}
                      >
                        {pctT1 >= 15 && `${pctT1}%`}
                      </div>
                      <div 
                        className="bg-gradient-to-r from-violet-600 to-indigo-500 h-full flex items-center justify-end pr-3 text-[9px] font-black text-white transition-all duration-500"
                        style={{ width: `${pctT2}%` }}
                      >
                        {pctT2 >= 15 && `${pctT2}%`}
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 w-10 text-right">{t2.short_name}</span>
                  </div>

                  {/* Vote Buttons */}
                  {!isVotingLocked && !hasVoted && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button
                        onClick={() => handleVote(liveMatch.team1)}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 hover:border-emerald-500/40 text-emerald-400 font-extrabold py-2 px-3 rounded-xl text-[10px] uppercase tracking-wider transition-all"
                      >
                        Vote {t1.short_name}
                      </button>
                      <button
                        onClick={() => handleVote(liveMatch.team2)}
                        className="bg-violet-600/10 hover:bg-violet-600/20 border border-violet-600/25 hover:border-violet-600/40 text-violet-400 font-extrabold py-2 px-3 rounded-xl text-[10px] uppercase tracking-wider transition-all"
                      >
                        Vote {t2.short_name}
                      </button>
                    </div>
                  )}

                  {hasVoted && (
                    <div className="text-[9px] text-center text-slate-500 font-bold uppercase tracking-wider">
                      You voted for <span className="text-emerald-450 font-black">{userVote === liveMatch.team1 ? t1.name : t2.name}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="mt-4 pt-4 border-t border-slate-800/40 flex items-center justify-between gap-4" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setSelectedPopupMatch(liveMatch)}
                className="flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/45 rounded-xl text-[10px] uppercase font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Users className="w-3.5 h-3.5 text-emerald-450" />
                <span>Scorecard</span>
              </button>
              <button
                onClick={() => {
                  setSelectedAnalyticsMatch(liveMatch);
                  setAnalyticsTab('worm');
                }}
                className="flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/45 rounded-xl text-[10px] uppercase font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-450" />
                <span>Analytics</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ----------------- 2. MATCHES LIST CARD GRID ----------------- */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-200">Matches Schedule & Results</h2>
            <p className="text-xs text-slate-500 mt-0.5">Click any match card to view rosters or full scorecards</p>
          </div>

          {/* Filtering tabs */}
          <div className="w-full sm:w-auto flex gap-1.5 bg-slate-950/40 p-1 rounded-xl border border-slate-850 overflow-x-auto scrollbar-none shrink-0">
            {(['all', 'live', 'upcoming', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all shrink-0 ${filterTab === tab
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Match cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filteredMatches.map((match) => {
            const isLive = match.status === 'Live';
            const isCompleted = match.status === 'Completed';
            return (
              <div
                key={match.id}
                onClick={() => setSelectedPopupMatch(match)}
                className={`glass-panel p-5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between hover:scale-[1.01] ${isLive
                    ? 'border-emerald-500/30 neon-glow-emerald'
                    : isCompleted
                      ? 'border-violet-500/20'
                      : 'border-slate-800/80 hover:border-slate-700'
                  }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{match.stage}</span>
                    <div className="flex items-center gap-1.5">
                      {match.delay_reason && (
                        <span className="flex items-center gap-1 text-[8px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 animate-pulse">
                          {match.delay_reason.toLowerCase().includes('rain') ? '🌧️ DELAYED' : '⚠️ DELAYED'}
                        </span>
                      )}
                      {isLive && (
                        <span className="flex items-center gap-1 text-[8px] font-black text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                          <span className="w-1 h-1 rounded-full bg-rose-500 pulse-fast" />
                          LIVE
                        </span>
                      )}
                      {isCompleted && (
                        <span className="flex items-center gap-0.5 text-[8px] font-black text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">
                          <Trophy className="w-2.5 h-2.5" />
                          END
                        </span>
                      )}
                      {!isLive && !isCompleted && (
                        <span className="flex items-center gap-1 text-[8px] font-bold text-slate-500 bg-slate-800/30 px-2 py-0.5 rounded-full">
                          <Clock className="w-2.5 h-2.5" />
                          SCHED
                        </span>
                      )}
                    </div>
                  </div>

                  {match.match_time && (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold mb-3">
                      <Clock className="w-3.5 h-3.5 text-emerald-500/80" />
                      <span>{formatMatchTime(match.match_time)}</span>
                    </div>
                  )}

                  {/* Teams Score section */}
                  {renderCardScore(match)}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-900/40 flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenPopupToSquads(true);
                      setSelectedPopupMatch(match);
                    }}
                    className="hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>View Squads</span>
                  </button>
                  {(isLive || isCompleted) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnalyticsMatch(match);
                        setAnalyticsTab('worm');
                      }}
                      className="hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Analytics</span>
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenPopupToSquads(false);
                      setSelectedPopupMatch(match);
                    }}
                    className="hover:text-emerald-400 transition-colors flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>{isCompleted ? 'Full Scorecard' : isLive ? 'Track Live' : 'Rosters'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            );
          })}
          {filteredMatches.length === 0 && (
            <div className="col-span-full py-16 text-center glass-panel rounded-2xl border border-slate-800 text-xs text-slate-500">
              No matches found in this category
            </div>
          )}
        </div>
      </div>

      {/* ----------------- 3. DETAILED SCORECARD MODAL ----------------- */}
      {selectedPopupMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overflow-x-hidden">
          <div className="w-full max-w-[calc(100vw-24px)] sm:max-w-3xl min-w-0 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl relative flex flex-col max-h-[95svh] sm:max-h-[90svh] overflow-hidden my-auto sm:my-8">

            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800/60 flex items-center justify-between shrink-0 gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">{selectedPopupMatch.stage}</span>
                  {selectedPopupMatch.match_time && (
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold bg-slate-955/40 px-2 py-0.5 rounded border border-slate-850 shrink-0">
                      <Clock className="w-3 h-3 text-emerald-500/80" />
                      {formatMatchTime(selectedPopupMatch.match_time)}
                    </span>
                  )}
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-200 mt-1 truncate">
                  {getTeam(selectedPopupMatch.team1)?.name} vs {getTeam(selectedPopupMatch.team2)?.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedPopupMatch(null)}
                className="p-1.5 bg-slate-950 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto overflow-x-hidden flex-1 space-y-6">

              {/* Suspended Alert Banner */}
              {selectedPopupMatch.delay_reason && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3 text-amber-300 animate-pulse">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                    {selectedPopupMatch.delay_reason.toLowerCase().includes('rain') ? (
                      <CloudRain className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">Play Suspended</h4>
                    <p className="text-xs font-bold text-slate-300 mt-0.5">{selectedPopupMatch.delay_reason}</p>
                  </div>
                </div>
              )}

              <>
                {/* A: UPCOMING MATCH VIEW (Squad list) */}
                {selectedPopupMatch.status === 'Upcoming' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-400 border-b border-slate-800 pb-2 mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-500" />
                        {getTeam(selectedPopupMatch.team1)?.name} Squad
                      </h4>
                      <div className="space-y-1.5">
                        {getTeamPlayers(selectedPopupMatch.team1).map(p => (
                          <div key={p.id} className="flex items-center gap-2 p-2 bg-slate-950/20 border border-slate-900/60 rounded-xl text-xs">
                            {p.photo ? (
                              <img src={getFileUrl('players', p.id, p.photo)} className="w-6 h-6 rounded-full object-cover shadow-sm shrink-0" alt="" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-500 shrink-0">
                                {p.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="text-slate-300 font-medium truncate flex-1 min-w-0">{formatPlayerName(p)}</span>
                            <span className="text-[9px] text-slate-500 font-bold uppercase ml-auto shrink-0">{p.role}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-400 border-b border-slate-800 pb-2 mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-500" />
                        {getTeam(selectedPopupMatch.team2)?.name} Squad
                      </h4>
                      <div className="space-y-1.5">
                        {getTeamPlayers(selectedPopupMatch.team2).map(p => (
                          <div key={p.id} className="flex items-center gap-2 p-2 bg-slate-950/20 border border-slate-900/60 rounded-xl text-xs">
                            {p.photo ? (
                              <img src={getFileUrl('players', p.id, p.photo)} className="w-6 h-6 rounded-full object-cover shadow-sm shrink-0" alt="" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-500 shrink-0">
                                {p.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="text-slate-300 font-medium truncate flex-1 min-w-0">{formatPlayerName(p)}</span>
                            <span className="text-[9px] text-slate-500 font-bold uppercase ml-auto shrink-0">{p.role}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* B: LIVE OR COMPLETED MATCH VIEWER */}
                {(selectedPopupMatch.status === 'Live' || selectedPopupMatch.status === 'Completed') && popupInnings.length > 0 && (
                  <div className="space-y-6">
                    {/* Innings & Squads Tabs */}
                    <div className="w-full flex gap-2 bg-slate-950/40 p-1 rounded-xl border border-slate-850 overflow-x-auto scrollbar-none shrink-0">
                      {popupInnings.map((inn, index) => {
                        const bTeam = getTeam(inn.batting_team);
                        const state = getInningState(inn, popupDeliveries);
                        return (
                          <button
                            key={inn.id}
                            onClick={() => setPopupInningTab(index)}
                            className={`flex-1 min-w-[120px] shrink-0 flex items-center justify-center gap-1.5 text-center py-2 rounded-lg text-[10.5px] sm:text-xs font-extrabold uppercase tracking-wide transition-all cursor-pointer ${popupInningTab === index
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                              }`}
                          >
                            {bTeam && getTeamLogo(bTeam) && (
                              <img src={getTeamLogo(bTeam)} alt="" className="w-4 h-4 rounded-md object-cover border border-slate-800" />
                            )}
                            <span>
                              {index >= 2 ? `SO ${Math.floor((index - 2) / 2) + 1}: ` : ''}{bTeam?.short_name} {state.totalRuns}/{state.totalWickets} <span className="text-[9px] font-normal lowercase">({state.oversStr}/{index >= 2 ? 1 : (selectedPopupMatch?.overs_limit || 5)} ov)</span>
                            </span>
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setPopupInningTab(popupInnings.length)}
                        className={`flex-1 min-w-[100px] shrink-0 flex items-center justify-center gap-1.5 text-center py-2 rounded-lg text-[10.5px] sm:text-xs font-extrabold uppercase tracking-wide transition-all cursor-pointer ${popupInningTab === popupInnings.length
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                          }`}
                      >
                        <Users className="w-4 h-4 text-emerald-450" />
                        <span>Squads</span>
                      </button>
                    </div>

                    {/* Recent Balls Ticker */}
                    {popupInnings[popupInningTab] && (() => {
                      const inn = popupInnings[popupInningTab];
                      const innDeliveries = popupDeliveries.filter(d => d.inning === inn.id);
                      if (innDeliveries.length === 0) return null;

                      const isLastInning = popupInningTab === popupInnings.length - 1;
                      const state = getInningState(inn, popupDeliveries);
                      const isComplete = !isLastInning || selectedPopupMatch.status === 'Completed' || state.totalWickets >= 10 || state.totalBalls >= (selectedPopupMatch.overs_limit || 5) * 6;
                      const tickerItems = getRecentBallsTicker(innDeliveries, isComplete);
                      return (
                        <div className="glass-panel p-4 rounded-xl border border-slate-850/80 space-y-2.5">
                          <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">
                            Recent Ball-by-Ball Ticker
                          </span>
                          <DragScrollContainer>
                            {tickerItems.map((item) => {
                              if (item.type === 'over-divider') {
                                return (
                                  <div key={item.id} className="flex flex-col items-center justify-center px-3 border-l border-r border-slate-800/80 shrink-0">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{item.label}</span>
                                    <span className="text-[10px] text-slate-400 font-extrabold uppercase mt-0.5">{item.overRuns} RUNS</span>
                                  </div>
                                );
                              }
                              return (
                                <div key={item.id} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${item.badgeClass}`}>
                                  {item.label}
                                </div>
                              );
                            })}
                          </DragScrollContainer>
                        </div>
                      );
                    })()}

                    {/* Scorecard Tab Body */}
                    {popupInnings[popupInningTab] && (() => {
                      const inn = popupInnings[popupInningTab];
                      const state = getInningState(inn, popupDeliveries);
                      const bTeam = getTeam(inn.batting_team);
                      const innDeliveries = popupDeliveries.filter(d => d.inning === inn.id);

                      const isCurrentlyBatting = selectedPopupMatch.status === 'Live' && popupInningTab === popupInnings.length - 1;

                      return (
                        <div className="space-y-6">

                          {/* Batting Card */}
                          <div>
                            <h4 className={`text-xs font-black uppercase tracking-wider border-b border-slate-800 pb-2 mb-3 transition-colors ${isCurrentlyBatting ? 'text-emerald-400 font-extrabold text-sm' : 'text-slate-400'
                              }`}>
                              {isCurrentlyBatting && '🏏 '}{bTeam?.name} {popupInningTab >= 2 ? 'Super Over ' : ''}Innings Batting
                            </h4>

                            <div className="overflow-x-auto w-full">
                              <table className="w-full min-w-[550px] text-left text-xs border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-800 text-slate-500 font-bold">
                                    <th className="py-2.5">Batter</th>
                                    <th className="py-2.5">Dismissal</th>
                                    <th className="py-2.5 text-right">R</th>
                                    <th className="py-2.5 text-right">B</th>
                                    <th className="py-2.5 text-right">4s</th>
                                    <th className="py-2.5 text-right">6s</th>
                                    <th className="py-2.5 text-right">SR</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {/* Generate rows of batters who faced balls in this inning */}
                                  {Object.entries(state.batsmanRuns).map(([bId, runs]) => {
                                    const batter = getPlayer(bId);
                                    const balls = state.batsmanBalls[bId] || 0;
                                    const fours = state.batsmanFours[bId] || 0;
                                    const sixes = state.batsmanSixes[bId] || 0;
                                    const dis = state.batsmanDismissal[bId] || 'not out';

                                    return (
                                      <tr key={bId} className="border-b border-slate-900/60 hover:bg-slate-950/20">
                                        <td className="py-2.5 font-bold text-slate-200 flex items-center gap-1.5">
                                          {formatPlayerName(batter)}
                                        </td>
                                        <td className={`py-2.5 text-xs ${dis === 'not out' ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                                          {dis}
                                        </td>
                                        <td className="py-2.5 text-right font-extrabold text-slate-200">{runs}</td>
                                        <td className="py-2.5 text-right text-slate-400">{balls}</td>
                                        <td className="py-2.5 text-right text-slate-400">{fours}</td>
                                        <td className="py-2.5 text-right text-slate-400">{sixes}</td>
                                        <td className="py-2.5 text-right text-slate-500">{calculateBattingSR(runs, balls)}</td>
                                      </tr>
                                    );
                                  })}
                                  {Object.keys(state.batsmanRuns).length > 0 && (
                                    <>
                                      {/* Extras Row */}
                                      <tr className="border-t border-slate-800 text-slate-400 font-medium bg-slate-950/10">
                                        <td className="py-2.5 font-semibold text-slate-400">Extras</td>
                                        <td colSpan={6} className="py-2.5 text-left text-slate-400 font-semibold pl-4">
                                          {state.totalExtras} <span className="text-slate-500 font-normal text-[11px] ml-1.5">(wd {state.extrasWides}, nb {state.extrasNoBalls}, b {state.extrasByes}, lb {state.extrasLegByes})</span>
                                        </td>
                                      </tr>
                                      {/* Total Score Row */}
                                      <tr className="border-t border-slate-800 font-bold bg-slate-950/20">
                                        <td className="py-3 text-slate-200">Total</td>
                                        <td colSpan={6} className="py-3 text-left pl-4 text-emerald-400 text-sm">
                                          {state.totalRuns}/{state.totalWickets} <span className="text-slate-500 text-xs font-semibold ml-1.5">({state.oversStr} Ov)</span>
                                        </td>
                                      </tr>
                                    </>
                                  )}
                                  {Object.keys(state.batsmanRuns).length === 0 && (
                                    <tr>
                                      <td colSpan={7} className="text-center py-6 text-slate-500 italic">Inning in preparation</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Bowling Card */}
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2 mb-3">
                              Bowling Performance
                            </h4>

                            <div className="overflow-x-auto w-full">
                              <table className="w-full min-w-[500px] text-left text-xs border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-800 text-slate-500 font-bold">
                                    <th className="py-2.5">Bowler</th>
                                    <th className="py-2.5 text-right">Overs</th>
                                    <th className="py-2.5 text-right">Runs</th>
                                    <th className="py-2.5 text-right">Wickets</th>
                                    <th className="py-2.5 text-right">WD</th>
                                    <th className="py-2.5 text-right">NB</th>
                                    <th className="py-2.5 text-right">Econ</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(state.bowlerBalls).map(([bowlerId, balls]) => {
                                    const bowler = getPlayer(bowlerId);
                                    const runs = state.bowlerRuns[bowlerId] || 0;
                                    const wickets = state.bowlerWickets[bowlerId] || 0;
                                    const wides = state.bowlerWides[bowlerId] || 0;
                                    const noBalls = state.bowlerNoBalls[bowlerId] || 0;

                                    return (
                                      <tr key={bowlerId} className="border-b border-slate-900/60 hover:bg-slate-950/20">
                                        <td className="py-2.5 font-bold text-slate-200">{formatPlayerName(bowler)}</td>
                                        <td className="py-2.5 text-right text-slate-300 font-medium">{formatBowlerOvers(balls)}</td>
                                        <td className="py-2.5 text-right text-slate-300">{runs}</td>
                                        <td className="py-2.5 text-right font-extrabold text-emerald-400">{wickets}</td>
                                        <td className="py-2.5 text-right text-slate-400">{wides}</td>
                                        <td className="py-2.5 text-right text-slate-400">{noBalls}</td>
                                        <td className="py-2.5 text-right text-slate-500">{calculateBowlerEcon(runs, balls)}</td>
                                      </tr>
                                    );
                                  })}
                                  {Object.keys(state.bowlerBalls).length === 0 && (
                                    <tr>
                                      <td colSpan={7} className="text-center py-6 text-slate-500 italic">No bowling recorded</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Ball by Ball Commentary (Phase 2 Upgrade!) */}
                          <div className="mt-6">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2 mb-3">
                              Inning Ball-by-Ball Commentary
                            </h4>
                            <div className="max-h-48 overflow-y-auto pr-1 space-y-2 bg-slate-950/45 border border-slate-900/60 p-3 rounded-xl scrollbar-thin scrollbar-thumb-slate-800/80">
                              {innDeliveries.length === 0 ? (
                                <div className="text-center py-6 text-xs text-slate-500 italic">No deliveries recorded in this inning yet.</div>
                              ) : (
                                [...innDeliveries].reverse().map((d) => (
                                  <div key={d.id} className="flex items-start gap-2.5 text-xs py-1.5 border-b border-slate-900/30 hover:bg-slate-950/10 transition-colors">
                                    <span className="font-extrabold text-slate-450 min-w-[28px] text-right shrink-0 bg-slate-950/45 px-1 py-0.5 rounded border border-slate-850">
                                      {d.over_number}.{d.ball_number}
                                    </span>
                                    <div className="flex-1 text-slate-300">
                                      <span className="font-bold text-slate-100">{getPlayer(d.striker)?.name || 'Striker'}</span>
                                      <span className="text-slate-550 mx-1">faced</span>
                                      <span className="font-bold text-slate-100">{getPlayer(d.bawler)?.name || 'Bowler'}</span>
                                      <span className="text-slate-400 font-medium"> - {renderCommentaryText(d)}</span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${d.is_wicket
                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                        : d.runs === 4 || d.runs === 6
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                          : d.is_extra
                                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/25'
                                            : 'bg-slate-950/40 text-slate-400 border border-slate-850'
                                      }`}>
                                      {d.is_wicket ? 'W' : d.is_extra ? d.extra_type : `${d.runs} R`}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Render Squads View Tab */}
                    {popupInningTab === popupInnings.length && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in pb-4">
                        {/* Team 1 Squad */}
                        {(() => {
                          const { playing, bench } = getMatchSquads(selectedPopupMatch, selectedPopupMatch.team1);
                          const t1Name = getTeam(selectedPopupMatch.team1)?.name || 'Team 1';
                          return (
                            <div className="space-y-4">
                              <h4 className="text-xs font-black uppercase text-slate-400 border-b border-slate-800 pb-2 flex items-center gap-2">
                                <Users className="w-4 h-4 text-slate-500" />
                                {t1Name} Squad
                              </h4>

                              <div className="space-y-3">
                                <div>
                                  <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider block mb-2">
                                    Playing XI ({playing.length})
                                  </span>
                                  {playing.length === 0 ? (
                                    <div className="text-xs text-slate-500 italic p-3 bg-slate-950/20 border border-slate-900/40 rounded-xl">
                                      No playing XI selected.
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {playing.map(p => (
                                        <div key={p.id} className="flex items-center gap-2 p-2 bg-slate-950/20 border border-slate-900/60 rounded-xl text-xs">
                                          {p.photo ? (
                                            <img src={getFileUrl('players', p.id, p.photo)} className="w-6 h-6 rounded-full object-cover shadow-sm shrink-0" alt="" />
                                          ) : (
                                            <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-500 shrink-0">
                                              {p.name.substring(0, 2).toUpperCase()}
                                            </div>
                                          )}
                                          <span className="text-slate-350 font-medium truncate flex-1 min-w-0">{formatPlayerName(p, selectedPopupMatch.team1)}</span>
                                          <span className="text-[9px] text-slate-500 font-bold uppercase ml-auto shrink-0">{p.role}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {bench.length > 0 && (
                                  <div>
                                    <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block mb-2">
                                      Bench / Subs ({bench.length})
                                    </span>
                                    <div className="space-y-1.5">
                                      {bench.map(p => (
                                        <div key={p.id} className="flex items-center gap-2 p-2 bg-slate-950/10 border border-slate-900/40 rounded-xl text-xs opacity-65">
                                          {p.photo ? (
                                            <img src={getFileUrl('players', p.id, p.photo)} className="w-6 h-6 rounded-full object-cover shadow-sm shrink-0" alt="" />
                                          ) : (
                                            <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-500 shrink-0">
                                              {p.name.substring(0, 2).toUpperCase()}
                                            </div>
                                          )}
                                          <span className="text-slate-400 font-medium truncate flex-1 min-w-0">{formatPlayerName(p, selectedPopupMatch.team1)}</span>
                                          <span className="text-[9px] text-slate-500 font-bold uppercase ml-auto shrink-0">{p.role}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Team 2 Squad */}
                        {(() => {
                          const { playing, bench } = getMatchSquads(selectedPopupMatch, selectedPopupMatch.team2);
                          const t2Name = getTeam(selectedPopupMatch.team2)?.name || 'Team 2';
                          return (
                            <div className="space-y-4">
                              <h4 className="text-xs font-black uppercase text-slate-400 border-b border-slate-800 pb-2 flex items-center gap-2">
                                <Users className="w-4 h-4 text-slate-500" />
                                {t2Name} Squad
                              </h4>

                              <div className="space-y-3">
                                <div>
                                  <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider block mb-2">
                                    Playing XI ({playing.length})
                                  </span>
                                  {playing.length === 0 ? (
                                    <div className="text-xs text-slate-550 italic p-3 bg-slate-950/20 border border-slate-900/40 rounded-xl">
                                      No playing XI selected.
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {playing.map(p => (
                                        <div key={p.id} className="flex items-center gap-2 p-2 bg-slate-950/20 border border-slate-900/60 rounded-xl text-xs">
                                          {p.photo ? (
                                            <img src={getFileUrl('players', p.id, p.photo)} className="w-6 h-6 rounded-full object-cover shadow-sm shrink-0" alt="" />
                                          ) : (
                                            <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-500 shrink-0">
                                              {p.name.substring(0, 2).toUpperCase()}
                                            </div>
                                          )}
                                          <span className="text-slate-350 font-medium truncate flex-1 min-w-0">{formatPlayerName(p, selectedPopupMatch.team2)}</span>
                                          <span className="text-[9px] text-slate-500 font-bold uppercase ml-auto shrink-0">{p.role}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {bench.length > 0 && (
                                  <div>
                                    <span className="text-[10px] text-slate-550 font-extrabold uppercase tracking-wider block mb-2">
                                      Bench / Subs ({bench.length})
                                    </span>
                                    <div className="space-y-1.5">
                                      {bench.map(p => (
                                        <div key={p.id} className="flex items-center gap-2 p-2 bg-slate-950/10 border border-slate-900/40 rounded-xl text-xs opacity-65">
                                          {p.photo ? (
                                            <img src={getFileUrl('players', p.id, p.photo)} className="w-6 h-6 rounded-full object-cover shadow-sm shrink-0" alt="" />
                                          ) : (
                                            <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-500 shrink-0">
                                              {p.name.substring(0, 2).toUpperCase()}
                                            </div>
                                          )}
                                          <span className="text-slate-400 font-medium truncate flex-1 min-w-0">{formatPlayerName(p, selectedPopupMatch.team2)}</span>
                                          <span className="text-[9px] text-slate-550 font-bold uppercase ml-auto shrink-0">{p.role}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Fallback if no innings played in live match */}
                {(selectedPopupMatch.status === 'Live' || selectedPopupMatch.status === 'Completed') && popupInnings.length === 0 && (
                  <div className="text-center py-12 text-slate-500 italic glass-panel border border-slate-800 rounded-2xl">
                    Match setup is complete. Scoring has not commenced yet.
                  </div>
                )}

              </>

            </div>

          </div>
        </div>
      )}

      {/* ----------------- 4. MATCH ANALYTICS MODAL ----------------- */}
      {selectedAnalyticsMatch && (() => {
        const team1 = getTeam(selectedAnalyticsMatch.team1);
        const team2 = getTeam(selectedAnalyticsMatch.team2);
        
        const inn1 = analyticsInnings.find(i => i.batting_team === selectedAnalyticsMatch.team1) || null;
        const inn2 = analyticsInnings.find(i => i.batting_team === selectedAnalyticsMatch.team2) || null;
        
        const inn1Dels = inn1 ? analyticsDeliveries.filter(d => d.inning === inn1.id) : [];
        const inn2Dels = inn2 ? analyticsDeliveries.filter(d => d.inning === inn2.id) : [];

        const isSpecialExtras = selectedAnalyticsMatch.special_extras || false;
        
        // Calculate Worm Data
        const inn1Worm = inn1 ? calculateWormData(inn1Dels, isSpecialExtras) : [];
        const inn2Worm = inn2 ? calculateWormData(inn2Dels, isSpecialExtras) : [];
        
        const maxOvers = selectedAnalyticsMatch.overs_limit || 5;
        const maxRuns = getMaxRuns(inn1Worm, inn2Worm);
        
        const color1 = team1 ? getTeamColor(team1) : '#3b82f6';
        const color2 = team2 ? getTeamColor(team2) : '#ec4899';
        
        // Calculate Stats Comparison
        const statsComp = getMatchStatsComparison(inn1, inn2, analyticsDeliveries);
        
        // Calculate Partnerships
        const partnerships1 = inn1 ? calculatePartnerships(inn1Dels, isSpecialExtras) : [];
        const partnerships2 = inn2 ? calculatePartnerships(inn2Dels, isSpecialExtras) : [];

        const StatRow = ({
          label,
          val1,
          val2,
          pct1,
          pct2,
          color1,
          color2
        }: {
          label: string;
          val1: string | number;
          val2: string | number;
          pct1: number;
          pct2: number;
          color1: string;
          color2: string;
        }) => (
          <div className="space-y-1.5 py-3 border-b border-slate-800/40 last:border-0">
            <div className="flex justify-between text-xs font-semibold text-slate-400">
              <span className="font-bold text-slate-200">{val1}</span>
              <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">{label}</span>
              <span className="font-bold text-slate-200">{val2}</span>
            </div>
            <div className="h-2 bg-slate-950 rounded-full overflow-hidden flex border border-slate-900">
              <div 
                className="h-full transition-all duration-500" 
                style={{ width: `${pct1}%`, backgroundColor: color1 }} 
              />
              <div 
                className="h-full transition-all duration-500" 
                style={{ width: `${pct2}%`, backgroundColor: color2 }} 
              />
            </div>
          </div>
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overflow-x-hidden">
            <div className="w-full max-w-[calc(100vw-24px)] sm:max-w-3xl min-w-0 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl relative flex flex-col max-h-[95svh] sm:max-h-[90svh] overflow-hidden my-auto sm:my-8">
              
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-800/60 flex items-center justify-between shrink-0 gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Match Analytics</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold bg-slate-955/40 px-2 py-0.5 rounded border border-slate-850 shrink-0">
                      <Clock className="w-3 h-3 text-emerald-500/80" />
                      {formatMatchTime(selectedAnalyticsMatch.match_time)}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-200 mt-1 truncate">
                    {team1?.name} vs {team2?.name}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedAnalyticsMatch(null)}
                  className="p-1.5 bg-slate-950 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="px-4 py-2 bg-slate-950/30 border-b border-slate-800/40 flex gap-2 shrink-0 overflow-x-auto scrollbar-none">
                <button
                  onClick={() => setAnalyticsTab('worm')}
                  className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    analyticsTab === 'worm'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/25 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Worm<span className="hidden sm:inline"> Graph</span></span>
                </button>
                <button
                  onClick={() => setAnalyticsTab('stats')}
                  className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    analyticsTab === 'stats'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/25 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span><span className="sm:hidden">Stats</span><span className="hidden sm:inline">Statistics</span></span>
                </button>
                <button
                  onClick={() => setAnalyticsTab('partnerships')}
                  className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    analyticsTab === 'partnerships'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/25 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span><span className="sm:hidden">Partners</span><span className="hidden sm:inline">Partnerships</span></span>
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="p-4 sm:p-6 overflow-y-auto overflow-x-hidden flex-1 space-y-6">
                
                {/* WORM GRAPH VIEW */}
                {analyticsTab === 'worm' && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Runs Over Overs (Worm)</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Wickets are plotted as circles along the inning progression lines</p>
                    </div>

                    {/* Chart Container */}
                    <div className="glass-panel p-4 rounded-2xl border border-slate-850 bg-slate-950/20 relative overflow-visible">
                      {inn1Worm.length === 0 && inn2Worm.length === 0 ? (
                        <div className="h-64 flex items-center justify-center text-xs text-slate-550 italic">
                          No deliveries recorded to plot the chart.
                        </div>
                      ) : (
                        <div className="w-full overflow-x-auto scrollbar-none">
                          <svg viewBox="0 0 500 300" className="w-full h-auto overflow-visible select-none">
                            {/* Gridlines */}
                            {Array.from({ length: 6 }).map((_, idx) => {
                              const y = 20 + (idx * 245) / 5;
                              const runVal = Math.round(maxRuns - (idx * maxRuns) / 5);
                              return (
                                <g key={idx}>
                                  <line
                                    x1={40}
                                    y1={y}
                                    x2={480}
                                    y2={y}
                                    stroke="#1e293b"
                                    strokeWidth={1}
                                    strokeDasharray="4,4"
                                  />
                                  <text
                                    x={30}
                                    y={y + 3}
                                    textAnchor="end"
                                    fill="#64748b"
                                    fontSize={9}
                                    fontFamily="monospace"
                                  >
                                    {runVal}
                                  </text>
                                </g>
                              );
                            })}

                            {/* X-axis ticks (Overs) */}
                            {Array.from({ length: maxOvers + 1 }).map((_, idx) => {
                              const x = 40 + (idx * 440) / maxOvers;
                              return (
                                <g key={idx}>
                                  <line
                                    x1={x}
                                    y1={20}
                                    x2={x}
                                    y2={265}
                                    stroke="#1e293b"
                                    strokeWidth={1}
                                    strokeDasharray="4,4"
                                  />
                                  <text
                                    x={x}
                                    y={280}
                                    textAnchor="middle"
                                    fill="#64748b"
                                    fontSize={9}
                                    fontFamily="sans-serif"
                                  >
                                    {idx}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Axis Labels */}
                            <text
                              x={260}
                              y={295}
                              textAnchor="middle"
                              fill="#475569"
                              fontSize={9}
                              fontWeight="bold"
                            >
                              OVERS
                            </text>
                            <text
                              x={12}
                              y={142}
                              textAnchor="middle"
                              fill="#475569"
                              fontSize={9}
                              fontWeight="bold"
                              transform="rotate(-90 12 142)"
                            >
                              RUNS
                            </text>

                            {/* Inning 1 Line */}
                            {inn1Worm.length > 0 && (
                              <path
                                d={getPathD(inn1Worm, maxOvers, maxRuns)}
                                fill="none"
                                stroke={color1}
                                strokeWidth={2.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            )}

                            {/* Inning 2 Line */}
                            {inn2Worm.length > 0 && (
                              <path
                                d={getPathD(inn2Worm, maxOvers, maxRuns)}
                                fill="none"
                                stroke={color2}
                                strokeWidth={2.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            )}

                            {/* Inning 1 Wicket Markers */}
                            {inn1Worm.filter(p => p.isWicket).map((p, idx) => {
                              const x = 40 + (p.over / maxOvers) * 440;
                              const y = 20 + 245 - (p.runs / maxRuns) * 245;
                              return (
                                <g key={`inn1-w-${idx}`} className="group/wicket cursor-pointer">
                                  <circle
                                    cx={x}
                                    cy={y}
                                    r={4}
                                    fill="#ffffff"
                                    stroke={color1}
                                    strokeWidth={2}
                                  />
                                  <title>{`${p.wicketPlayer || 'Wicket'} (${p.over.toFixed(1)} ov, ${p.runs} runs)`}</title>
                                </g>
                              );
                            })}

                            {/* Inning 2 Wicket Markers */}
                            {inn2Worm.filter(p => p.isWicket).map((p, idx) => {
                              const x = 40 + (p.over / maxOvers) * 440;
                              const y = 20 + 245 - (p.runs / maxRuns) * 245;
                              return (
                                <g key={`inn2-w-${idx}`} className="group/wicket cursor-pointer">
                                  <circle
                                    cx={x}
                                    cy={y}
                                    r={4}
                                    fill="#ffffff"
                                    stroke={color2}
                                    strokeWidth={2}
                                  />
                                  <title>{`${p.wicketPlayer || 'Wicket'} (${p.over.toFixed(1)} ov, ${p.runs} runs)`}</title>
                                </g>
                              );
                            })}
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Chart Legends */}
                    <div className="flex justify-center gap-6">
                      {team1 && (
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: color1 }} />
                          <span className="text-xs font-bold text-slate-200">{team1.name}</span>
                          {inn1 && (
                            <span className="text-[10px] text-slate-400">
                              ({inn1Worm[inn1Worm.length - 1]?.runs || 0} runs)
                            </span>
                          )}
                        </div>
                      )}
                      {team2 && (
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: color2 }} />
                          <span className="text-xs font-bold text-slate-200">{team2.name}</span>
                          {inn2 && (
                            <span className="text-[10px] text-slate-400">
                              ({inn2Worm[inn2Worm.length - 1]?.runs || 0} runs)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* STATISTICS COMPARISON VIEW */}
                {analyticsTab === 'stats' && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Match Statistics Comparison</h4>
                    </div>

                    {statsComp.team1Stats && statsComp.team2Stats ? (
                      <div className="glass-panel p-5 rounded-2xl border border-slate-850 space-y-4">
                        {/* Header showing short names */}
                        <div className="flex justify-between items-center text-xs font-extrabold text-slate-400 border-b border-slate-800 pb-2 mb-2">
                          <span style={{ color: color1 }}>{team1?.short_name}</span>
                          <span className="text-[9px] text-slate-500 uppercase tracking-widest">METRIC</span>
                          <span style={{ color: color2 }}>{team2?.short_name}</span>
                        </div>

                        {/* Total Score */}
                        {(() => {
                          const val1 = `${statsComp.team1Stats.totalRuns}/${statsComp.team1Stats.totalWickets}`;
                          const val2 = `${statsComp.team2Stats.totalRuns}/${statsComp.team2Stats.totalWickets}`;
                          const r1 = statsComp.team1Stats.totalRuns;
                          const r2 = statsComp.team2Stats.totalRuns;
                          const tot = r1 + r2;
                          const pct1 = tot === 0 ? 50 : (r1 / tot) * 100;
                          const pct2 = 100 - pct1;
                          return (
                            <StatRow
                              label="Total Score"
                              val1={val1}
                              val2={val2}
                              pct1={pct1}
                              pct2={pct2}
                              color1={color1}
                              color2={color2}
                            />
                          );
                        })()}

                        {/* Run Rate */}
                        {(() => {
                          const r1 = parseFloat(statsComp.team1Stats.runRate);
                          const r2 = parseFloat(statsComp.team2Stats.runRate);
                          const tot = r1 + r2;
                          const pct1 = tot === 0 ? 50 : (r1 / tot) * 100;
                          const pct2 = 100 - pct1;
                          return (
                            <StatRow
                              label="Run Rate"
                              val1={statsComp.team1Stats.runRate}
                              val2={statsComp.team2Stats.runRate}
                              pct1={pct1}
                              pct2={pct2}
                              color1={color1}
                              color2={color2}
                            />
                          );
                        })()}

                        {/* Fours (4s) */}
                        {(() => {
                          const f1 = statsComp.team1Stats.fours;
                          const f2 = statsComp.team2Stats.fours;
                          const tot = f1 + f2;
                          const pct1 = tot === 0 ? 50 : (f1 / tot) * 100;
                          const pct2 = 100 - pct1;
                          return (
                            <StatRow
                              label="Fours (4s)"
                              val1={f1}
                              val2={f2}
                              pct1={pct1}
                              pct2={pct2}
                              color1={color1}
                              color2={color2}
                            />
                          );
                        })()}

                        {/* Sixes (6s) */}
                        {(() => {
                          const s1 = statsComp.team1Stats.sixes;
                          const s2 = statsComp.team2Stats.sixes;
                          const tot = s1 + s2;
                          const pct1 = tot === 0 ? 50 : (s1 / tot) * 100;
                          const pct2 = 100 - pct1;
                          return (
                            <StatRow
                              label="Sixes (6s)"
                              val1={s1}
                              val2={s2}
                              pct1={pct1}
                              pct2={pct2}
                              color1={color1}
                              color2={color2}
                            />
                          );
                        })()}

                        {/* Dot Balls */}
                        {(() => {
                          const d1 = statsComp.team1Stats.dotBalls;
                          const d2 = statsComp.team2Stats.dotBalls;
                          const tot = d1 + d2;
                          const pct1 = tot === 0 ? 50 : (d1 / tot) * 100;
                          const pct2 = 100 - pct1;
                          return (
                            <StatRow
                              label="Dot Balls"
                              val1={d1}
                              val2={d2}
                              pct1={pct1}
                              pct2={pct2}
                              color1={color1}
                              color2={color2}
                            />
                          );
                        })()}

                        {/* Extras */}
                        {(() => {
                          const e1 = statsComp.team1Stats.extras;
                          const e2 = statsComp.team2Stats.extras;
                          const tot = e1 + e2;
                          const pct1 = tot === 0 ? 50 : (e1 / tot) * 100;
                          const pct2 = 100 - pct1;
                          return (
                            <StatRow
                              label="Extras"
                              val1={`${e1} (wd${statsComp.team1Stats.wides}, nb${statsComp.team1Stats.noBalls})`}
                              val2={`${e2} (wd${statsComp.team2Stats.wides}, nb${statsComp.team2Stats.noBalls})`}
                              pct1={pct1}
                              pct2={pct2}
                              color1={color1}
                              color2={color2}
                            />
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-500 italic glass-panel border border-slate-800 rounded-2xl">
                        Match stats will be available as scoring progresses.
                      </div>
                    )}
                  </div>
                )}

                {/* PARTNERSHIPS VIEW */}
                {analyticsTab === 'partnerships' && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Partnership Breakdown</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Team 1 Partnerships */}
                      <div>
                        <h5 className="text-xs font-bold uppercase tracking-wider pb-2 border-b border-slate-850 mb-3" style={{ color: color1 }}>
                          {team1?.name} Partnerships
                        </h5>
                        {partnerships1.length === 0 ? (
                          <div className="text-xs text-slate-500 italic p-3 bg-slate-950/20 border border-slate-900/40 rounded-xl">
                            No partnerships recorded yet.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {partnerships1.map((p, idx) => (
                              <div key={idx} className="p-3 bg-slate-950/20 border border-slate-900/60 rounded-xl space-y-1 text-xs">
                                <div className="flex justify-between items-center font-bold text-slate-200">
                                  <span>Wicket #{p.wicketNum}</span>
                                  <span className="text-emerald-400 font-extrabold">{p.runs} runs <span className="text-slate-500 font-normal">({p.balls}b)</span></span>
                                </div>
                                <div className="text-[11px] text-slate-400 mt-1">
                                  Batters: <span className="text-slate-300 font-semibold">{getBatterNames(p.batters)}</span>
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Ended by: <span className="text-rose-400/90 font-medium">{p.endedBy}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Team 2 Partnerships */}
                      <div>
                        <h5 className="text-xs font-bold uppercase tracking-wider pb-2 border-b border-slate-850 mb-3" style={{ color: color2 }}>
                          {team2?.name} Partnerships
                        </h5>
                        {partnerships2.length === 0 ? (
                          <div className="text-xs text-slate-500 italic p-3 bg-slate-950/20 border border-slate-900/40 rounded-xl">
                            No partnerships recorded yet.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {partnerships2.map((p, idx) => (
                              <div key={idx} className="p-3 bg-slate-950/20 border border-slate-900/60 rounded-xl space-y-1 text-xs">
                                <div className="flex justify-between items-center font-bold text-slate-200">
                                  <span>Wicket #{p.wicketNum}</span>
                                  <span className="text-emerald-400 font-extrabold">{p.runs} runs <span className="text-slate-500 font-normal">({p.balls}b)</span></span>
                                </div>
                                <div className="text-[11px] text-slate-400 mt-1">
                                  Batters: <span className="text-slate-300 font-semibold">{getBatterNames(p.batters)}</span>
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Ended by: <span className="text-rose-400/90 font-medium">{p.endedBy}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
