import React, { useState, useEffect } from 'react';
import { pb, getTeamLogo, getFileUrl } from '../services/pocketbase';
import type { Player, Team, Delivery, Match, FantasyTeam, TournamentConfig } from '../services/pocketbase';
import { Trophy, Users, Sparkles, Trash2, Save, Search, Info, ShieldAlert, BadgeInfo, LayoutGrid, List } from 'lucide-react';
import { parseStage } from '../services/bracketUtils';

interface FantasyLeagueProps {
  players: Player[];
  teams: Team[];
  matches: Match[];
  isConnected: boolean;
  tournamentConfig: TournamentConfig | null;
}

// Calculate fantasy points for a single player
export const calculatePlayerFantasyPoints = (playerId: string, deliveries: Delivery[]) => {
  let points = 0;

  // 1. Batting points
  const battingDels = deliveries.filter(d => d.striker === playerId);
  const runs = battingDels.reduce((sum, d) => {
    const isWide = d.extra_type === 'Wide';
    const isNoBall = d.extra_type === 'No Ball';
    if (isWide) return sum;
    const isByeOrLegBye = d.extra_type === 'Bye' || d.extra_type === 'Leg Bye';
    const runOffBat = isByeOrLegBye ? 0 : (isNoBall ? Math.max(0, (d.runs || 0) - 1) : (d.runs || 0));
    return sum + runOffBat;
  }, 0);

  const fours = battingDels.filter(d => d.extra_type !== 'Wide' && d.runs_off_bat === 4).length;
  const sixes = battingDels.filter(d => d.extra_type !== 'Wide' && d.runs_off_bat === 6).length;
  const isOut = deliveries.some(d => d.is_wicket && d.out_player === playerId);

  points += runs; // 1 pt per run
  points += fours * 1; // 1 pt per four boundary
  points += sixes * 2; // 2 pt per six boundary
  if (runs >= 50 && runs < 100) points += 10; // 50+ runs bonus
  if (runs >= 100) points += 20; // 100+ runs bonus
  if (isOut && runs === 0) points -= 5; // duck penalty

  // 2. Bowling points
  const bowlingDels = deliveries.filter(d => d.bawler === playerId);
  const wickets = bowlingDels.filter(d => d.is_wicket && d.dismissal_type !== 'Run Out' && d.dismissal_type !== 'Retired Out' && d.dismissal_type !== 'None').length;
  const dotBalls = bowlingDels.filter(d => d.runs === 0 && d.extra_type === 'None').length;

  points += wickets * 25; // 25 pts per wicket
  points += dotBalls * 1; // 1 pt per dot ball
  if (wickets >= 3 && wickets < 5) points += 10; // 3 wickets bonus
  if (wickets >= 5) points += 20; // 5+ wickets bonus

  // 3. Fielding points
  const catches = deliveries.filter(d => d.is_wicket && d.dismissal_type === 'Catch' && d.fielder === playerId).length;
  const stumpings = deliveries.filter(d => d.is_wicket && d.dismissal_type === 'Stumped' && d.fielder === playerId).length;
  const runouts = deliveries.filter(d => d.is_wicket && d.dismissal_type === 'Run Out' && d.fielder === playerId).length;

  points += catches * 8; // 8 pts per catch
  points += stumpings * 8; // 8 pts per stumping
  points += runouts * 6; // 6 pts per runout participation

  return points;
};

// Generate browser fingerprint hash
const getBrowserFingerprint = () => {
  if (typeof window === 'undefined') return '';
  const parts = [
    navigator.userAgent || '',
    navigator.language || '',
    screen.colorDepth || '',
    screen.width || '',
    screen.height || '',
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || '',
    (navigator as any).deviceMemory || '',
    (navigator as any).platform || ''
  ];
  const str = parts.join('###');
  // Simple fast string hash
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
};

export const FantasyLeague: React.FC<FantasyLeagueProps> = ({ players, teams, matches, isConnected, tournamentConfig }) => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [fantasyTeams, setFantasyTeams] = useState<FantasyTeam[]>([]);
  const [innings, setInnings] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');

  // Local user's fantasy team ID from localStorage
  const [myTeamId, setMyTeamId] = useState<string | null>(localStorage.getItem('fantasy_team_id'));
  const [teamNameInput, setTeamNameInput] = useState('');
  const [ownerNameInput, setOwnerNameInput] = useState('');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [captainId, setCaptainId] = useState<string>('');
  const [viceCaptainId, setViceCaptainId] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [dreamTeamView, setDreamTeamView] = useState<'field' | 'list'>('field');

  const fetchData = async () => {
    try {
      const [deliveryRecords, fTeamRecords, inningRecords] = await Promise.all([
        pb.collection('deliveries').getFullList<Delivery>({ requestKey: null }),
        pb.collection('fantasy_teams').getFullList<FantasyTeam>({
          expand: 'players,players.team,captain,vice_captain',
          sort: '-created',
          requestKey: null
        }),
        pb.collection('innings').getFullList({ requestKey: null })
      ]);
      setDeliveries(deliveryRecords);
      setFantasyTeams(fTeamRecords);
      setInnings(inningRecords);
    } catch (err) {
      console.error('Error fetching fantasy data:', err);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to real-time changes
    pb.collection('deliveries').subscribe('*', () => fetchData());
    pb.collection('fantasy_teams').subscribe('*', () => fetchData());

    return () => {
      pb.collection('deliveries').unsubscribe('*');
      pb.collection('fantasy_teams').unsubscribe('*');
    };
  }, []);

  // Update builder inputs when user's existing team is loaded
  useEffect(() => {
    if (myTeamId && fantasyTeams.length > 0) {
      const myTeam = fantasyTeams.find(t => t.id === myTeamId);
      if (myTeam) {
        setTeamNameInput(myTeam.name);
        setOwnerNameInput(myTeam.owner_name);
        setSelectedPlayerIds(myTeam.players || []);
        setCaptainId(myTeam.captain || '');
        setViceCaptainId(myTeam.vice_captain || '');
      } else {
        // If myTeamId was set but is not found in the loaded list, clear it!
        console.warn('Local fantasy team ID not found on server, clearing reference.');
        localStorage.removeItem('fantasy_team_id');
        setMyTeamId(null);
      }
    }
  }, [myTeamId, fantasyTeams]);

  // Fingerprint auto-recovery
  useEffect(() => {
    if (!myTeamId && fantasyTeams.length > 0) {
      const fp = getBrowserFingerprint();
      const matchedTeam = fantasyTeams.find(t => t.fingerprint === fp);
      if (matchedTeam) {
        console.log('Auto-recovered fantasy team via browser fingerprint:', matchedTeam.name);
        localStorage.setItem('fantasy_team_id', matchedTeam.id);
        setMyTeamId(matchedTeam.id);
      }
    }
  }, [myTeamId, fantasyTeams]);

  // Check if live match is active (lock squads when a match is live)
  const isMatchLive = matches.some(m => m.status === 'Live');
  const isStrict = tournamentConfig?.strict_fantasy_roles !== false;
  const isFinalStarted = matches.some(m => m.stage === 'Final' && (m.status === 'Live' || m.status === 'Completed'));
  const isFinalCompleted = matches.some(m => m.stage === 'Final' && m.status === 'Completed');
  const isSquadLocked = isMatchLive || isFinalStarted;

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

  // 2. Compute Player points map
  const playerPointsMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    players.forEach(p => {
      map[p.id] = calculatePlayerFantasyPoints(p.id, filteredDeliveries);
    });
    return map;
  }, [players, filteredDeliveries]);

  // Compute Selection % popularity map based on all fan teams
  const selectionMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    players.forEach(p => {
      map[p.id] = 0;
    });

    fantasyTeams.forEach(t => {
      (t.players || []).forEach(pId => {
        if (map[pId] !== undefined) {
          map[pId] += 1;
        }
      });
    });

    const totalTeams = fantasyTeams.length || 1;
    const percentMap: Record<string, number> = {};
    players.forEach(p => {
      percentMap[p.id] = Math.round(((map[p.id] || 0) / totalTeams) * 100);
    });
    return percentMap;
  }, [players, fantasyTeams]);

  const getScopedDeliveriesForTeam = (teamCreatedStr?: string) => {
    if (!teamCreatedStr) return filteredDeliveries;
    const teamCreatedTime = new Date(teamCreatedStr).getTime();
    if (isNaN(teamCreatedTime)) return filteredDeliveries;

    return filteredDeliveries.filter(d => {
      if (!d.created) return true;
      const deliveryTime = new Date(d.created).getTime();
      return isNaN(deliveryTime) || deliveryTime >= (teamCreatedTime - 600000); // 10 min grace period
    });
  };

  // 3. Compute Fantasy Team Leaderboard (applying C = 2.0x, VC = 1.5x, and Scoped Deliveries)
  const leaderboard = React.useMemo(() => {
    return fantasyTeams.map(t => {
      const squad = t.players || [];
      const scopedDels = getScopedDeliveriesForTeam(t.created);

      const totalPoints = squad.reduce((sum, pId) => {
        let pts = calculatePlayerFantasyPoints(pId, scopedDels);
        if (pId === t.captain) {
          pts *= 2.0;
        } else if (pId === t.vice_captain) {
          pts *= 1.5;
        }
        return sum + pts;
      }, 0);
      return {
        ...t,
        totalPoints: Math.round(totalPoints * 10) / 10
      };
    }).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [fantasyTeams, players, filteredDeliveries]);

  // Find user's rank
  const myRank = leaderboard.findIndex(t => t.id === myTeamId) + 1;

  // Identify top performance and popularity players
  const topPerformancePlayerId = React.useMemo(() => {
    if (players.length === 0) return '';
    let topId = '';
    let maxPts = -1;
    players.forEach(p => {
      const pts = playerPointsMap[p.id] || 0;
      if (pts > maxPts) {
        maxPts = pts;
        topId = p.id;
      }
    });
    return topId;
  }, [players, playerPointsMap]);

  const topPopularityPlayerId = React.useMemo(() => {
    if (players.length === 0) return '';
    let topId = '';
    let maxPct = -1;
    players.forEach(p => {
      const pct = selectionMap[p.id] || 0;
      if (pct > maxPct) {
        maxPct = pct;
        topId = p.id;
      }
    });
    return topId;
  }, [players, selectionMap]);

  // Helper to get highlight badge info for a player
  const getPlayerHighlightBadge = (pId: string) => {
    const isTopPerf = pId === topPerformancePlayerId;
    const isTopPop = pId === topPopularityPlayerId;

    if (isTopPerf && isTopPop) {
      return {
        text: '👑 Overall #1',
        style: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
      };
    }
    if (isTopPerf) {
      return {
        text: '⚡ MVP',
        style: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20'
      };
    }
    if (isTopPop) {
      return {
        text: '🌟 Fan Favorite',
        style: 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-black shadow-lg shadow-violet-500/20'
      };
    }
    return null;
  };

  // Calculate Optimal Tournament Dream Team based on actual performance (IPL Rules)
  const tournamentDreamTeam = React.useMemo(() => {
    if (players.length === 0) return null;

    // Sort all players by individual points
    const sortedPlayers = [...players].map(p => ({
      ...p,
      points: playerPointsMap[p.id] || 0
    })).sort((a, b) => b.points - a.points);

    const selected: typeof sortedPlayers = [];
    const getCountByRole = (list: typeof sortedPlayers) => {
      return list.reduce((acc, p) => {
        acc[p.role] = (acc[p.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    };
    const getCountByTeam = (list: typeof sortedPlayers) => {
      return list.reduce((acc, p) => {
        acc[p.team] = (acc[p.team] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    };

    // Ensure WK >= 1, Batter >= 3, Bowler >= 3, All-Rounder >= 1 if strict roles are active
    if (isStrict) {
      const wks = sortedPlayers.filter(p => p.role === 'Wicket Keeper');
      if (wks.length > 0) selected.push(wks[0]);

      const batters = sortedPlayers.filter(p => p.role === 'Batter');
      batters.slice(0, 3).forEach(p => {
        if (!selected.some(x => x.id === p.id)) selected.push(p);
      });

      const bowlers = sortedPlayers.filter(p => p.role === 'Bawler');
      bowlers.slice(0, 3).forEach(p => {
        if (!selected.some(x => x.id === p.id)) selected.push(p);
      });

      const allRounders = sortedPlayers.filter(p => p.role === 'All-Rounder');
      if (allRounders.length > 0) {
        const ar = allRounders[0];
        if (!selected.some(x => x.id === ar.id)) selected.push(ar);
      }
    }

    // Fill remaining slots up to 11
    for (const player of sortedPlayers) {
      if (selected.length >= 11) break;
      if (selected.some(x => x.id === player.id)) continue;

      const teamCounts = getCountByTeam(selected);
      const currentTeamCount = teamCounts[player.team] || 0;
      if (currentTeamCount >= 10) continue; // max 10 from one team

      if (isStrict) {
        const roleCounts = getCountByRole(selected);
        const currentRoleCount = roleCounts[player.role] || 0;

        // Max caps
        if (player.role === 'Wicket Keeper' && currentRoleCount >= 4) continue;
        if (player.role === 'Batter' && currentRoleCount >= 6) continue;
        if (player.role === 'Bawler' && currentRoleCount >= 6) continue;
        if (player.role === 'All-Rounder' && currentRoleCount >= 4) continue;
      }

      selected.push(player);
    }

    if (selected.length < 11) {
      // Fallback
      const fallback = sortedPlayers.slice(0, 11);
      return {
        players: fallback,
        captainId: fallback[0]?.id || '',
        viceCaptainId: fallback[1]?.id || '',
        totalPoints: fallback.reduce((sum, p, idx) => {
          let multiplier = 1;
          if (idx === 0) multiplier = 2;
          else if (idx === 1) multiplier = 1.5;
          return sum + p.points * multiplier;
        }, 0)
      };
    }

    selected.sort((a, b) => b.points - a.points);
    const captain = selected[0];
    const viceCaptain = selected[1];

    const totalPoints = selected.reduce((sum, p) => {
      let multiplier = 1;
      if (p.id === captain.id) multiplier = 2;
      else if (p.id === viceCaptain.id) multiplier = 1.5;
      return sum + p.points * multiplier;
    }, 0);

    return {
      players: selected,
      captainId: captain.id,
      viceCaptainId: viceCaptain.id,
      totalPoints
    };
  }, [players, playerPointsMap]);

  // 4. Squad constraints checking
  const getTeamOfPlayer = (pId: string) => players.find(p => p.id === pId)?.team;
  const getRoleOfPlayer = (pId: string) => players.find(p => p.id === pId)?.role;

  const countByTeam = selectedPlayerIds.reduce((acc, pId) => {
    const tId = getTeamOfPlayer(pId);
    if (tId) acc[tId] = (acc[tId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const countByRole = selectedPlayerIds.reduce((acc, pId) => {
    const role = getRoleOfPlayer(pId);
    if (role) acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Constraint results
  const isOverTeamLimit = Object.values(countByTeam).some(count => count > 10);
  const hasWK = (countByRole['Wicket Keeper'] || 0) >= 1 && (countByRole['Wicket Keeper'] || 0) <= 4;
  const hasBatter = (countByRole['Batter'] || 0) >= 3 && (countByRole['Batter'] || 0) <= 6;
  const hasAR = (countByRole['All-Rounder'] || 0) >= 1 && (countByRole['All-Rounder'] || 0) <= 4;
  const hasBowler = (countByRole['Bawler'] || 0) >= 3 && (countByRole['Bawler'] || 0) <= 6;
  const isSquadComplete = selectedPlayerIds.length === 11;
  const hasCaptain = !!captainId && selectedPlayerIds.includes(captainId);
  const hasViceCaptain = !!viceCaptainId && selectedPlayerIds.includes(viceCaptainId) && viceCaptainId !== captainId;
  const isValidSquad = isSquadComplete && 
    !isOverTeamLimit && 
    (!isStrict || (hasWK && hasBatter && hasAR && hasBowler)) && 
    hasCaptain && 
    (!viceCaptainId || hasViceCaptain);

  // 5. Select/deselect player
  const togglePlayerSelection = (player: Player) => {
    if (isSquadLocked) return; // Prevent selection changes when squad is locked
    
    if (selectedPlayerIds.includes(player.id)) {
      setSelectedPlayerIds(prev => prev.filter(id => id !== player.id));
      if (captainId === player.id) setCaptainId('');
      if (viceCaptainId === player.id) setViceCaptainId('');
    } else {
      if (selectedPlayerIds.length >= 11) return; // limit is 11
      setSelectedPlayerIds(prev => [...prev, player.id]);
    }
  };

  // 6. Save/update squad to PocketBase
  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      setSaveStatus('error');
      setSaveMessage('Unable to save: disconnected from the server.');
      return;
    }
    if (isSquadLocked) {
      setSaveStatus('error');
      setSaveMessage(isFinalStarted ? 'Squad changes are locked permanently since the Final has started!' : 'Squad changes are locked while a match is currently live!');
      return;
    }
    if (!teamNameInput.trim()) {
      setSaveStatus('error');
      setSaveMessage('Please enter a fantasy team name.');
      return;
    }
    if (!ownerNameInput.trim()) {
      setSaveStatus('error');
      setSaveMessage('Please enter your name.');
      return;
    }
    if (!isValidSquad) {
      setSaveStatus('error');
      let msg = 'Squad constraints failed: ';
      if (!isSquadComplete) msg += 'Must select exactly 11 players. ';
      else if (isOverTeamLimit) msg += 'Maximum 10 players from a single team. ';
      else if (isStrict && !hasWK) msg += 'Include 1-4 Wicket Keepers. ';
      else if (isStrict && !hasBatter) msg += 'Include 3-6 Batters. ';
      else if (isStrict && !hasAR) msg += 'Include 1-4 All-Rounders. ';
      else if (isStrict && !hasBowler) msg += 'Include 3-6 Bowlers. ';
      else if (!hasCaptain) msg += 'Select a Captain (C). ';
      else if (viceCaptainId && !hasViceCaptain) msg += 'Select a valid Vice-Captain (VC). ';
      setSaveMessage(msg);
      return;
    }

    setSaveStatus('saving');
    try {
      let savedRecord: FantasyTeam;

      const fp = getBrowserFingerprint();

      if (myTeamId) {
        try {
          // Update existing record
          savedRecord = await pb.collection('fantasy_teams').update<FantasyTeam>(myTeamId, {
            name: teamNameInput.trim(),
            owner_name: ownerNameInput.trim(),
            players: selectedPlayerIds,
            captain: captainId,
            vice_captain: viceCaptainId,
            fingerprint: fp
          });
        } catch (updateErr: any) {
          // If the resource was not found (404), clear local ID and create a new record
          if (updateErr.status === 404) {
            console.warn('Fantasy team ID not found on server during update. Creating a new record instead.');
            localStorage.removeItem('fantasy_team_id');
            setMyTeamId(null);
            
            savedRecord = await pb.collection('fantasy_teams').create<FantasyTeam>({
              name: teamNameInput.trim(),
              owner_name: ownerNameInput.trim(),
              players: selectedPlayerIds,
              captain: captainId,
              vice_captain: viceCaptainId,
              fingerprint: fp
            });
            localStorage.setItem('fantasy_team_id', savedRecord.id);
            setMyTeamId(savedRecord.id);
          } else {
            throw updateErr;
          }
        }
      } else {
        // Create new record
        savedRecord = await pb.collection('fantasy_teams').create<FantasyTeam>({
          name: teamNameInput.trim(),
          owner_name: ownerNameInput.trim(),
          players: selectedPlayerIds,
          captain: captainId,
          vice_captain: viceCaptainId,
          fingerprint: fp
        });
        localStorage.setItem('fantasy_team_id', savedRecord.id);
        setMyTeamId(savedRecord.id);
      }

      setSaveStatus('success');
      setSaveMessage('Your fantasy team has been saved successfully!');
      setTimeout(() => setSaveStatus('idle'), 4000);
    } catch (err: any) {
      console.error('Error saving fantasy team:', err);
      setSaveStatus('error');
      setSaveMessage(err.message || 'An error occurred while saving.');
    }
  };

  // Filter player list
  const filteredPlayers = players.filter(p => {
    const team = teams.find(t => t.id === p.team);
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (team && team.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          p.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'All' || p.role === roleFilter;
    return matchesSearch && matchesRole;
  }).sort((a, b) => (playerPointsMap[b.id] || 0) - (playerPointsMap[a.id] || 0));

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Welcome banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800/80 relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-64 h-64 bg-violet-600/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="text-center md:text-left space-y-2 max-w-2xl">
            <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-extrabold px-2.5 py-0.5 rounded-lg uppercase tracking-wider">
              CricTourney Engagement
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-100 tracking-tight">Dream 11 Fantasy League 🏏</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Create your dream team of **11 players** from the participating rosters. Nominate a **Captain (2x points)** and **Vice-Captain (1.5x points)**. Earn points for boundaries, wickets, catches, dot balls, and milestones in every live match.
            </p>
            {phaseSetting !== 'All' && (
              <div className="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-center gap-2 text-xs text-amber-300">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Phase Filter Active:</strong> Fantasy points calculated from <strong>{phaseSetting} Onwards</strong>.
                </span>
              </div>
            )}
          </div>
          {myTeamId && leaderboard.length > 0 && (
            <div className="bg-slate-950/80 border border-slate-850 p-5 rounded-2xl shrink-0 flex items-center gap-4 text-center sm:text-left shadow-lg">
              <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                <Trophy className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block">Your Rank</span>
                <span className="text-2xl font-black text-white">#{myRank || '-'}</span>
                <span className="text-xs text-emerald-400 font-semibold block mt-0.5">
                  {leaderboard.find(t => t.id === myTeamId)?.totalPoints || 0} Points
                </span>
              </div>
            </div>
          )}
        </div>
        </div>
        {/* TOURNAMENT DREAM XI SHOWCASE (Cricket Field layout) */}
      {tournamentDreamTeam && (
        <div className={`glass-panel p-5 sm:p-6 rounded-3xl border transition-all duration-500 relative overflow-hidden space-y-5 ${
          isFinalCompleted
            ? 'border-amber-500/60 bg-gradient-to-b from-slate-950 via-amber-950/20 to-slate-950 shadow-[0_0_50px_rgba(245,158,11,0.25)]'
            : 'border-slate-800/80 bg-gradient-to-b from-slate-950 via-slate-900/40 to-slate-950'
        }`}>
          <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] pointer-events-none transition-all duration-500 ${
            isFinalCompleted ? 'bg-amber-500/15 animate-pulse' : 'bg-violet-600/5'
          }`} />
          <div className="absolute -bottom-20 left-10 w-72 h-72 bg-emerald-500/5 rounded-full blur-[110px] pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-900 pb-3.5 relative z-10">
            <div>
              {isFinalCompleted ? (
                <span className="text-[10px] bg-gradient-to-r from-amber-500 to-yellow-550 text-slate-950 font-black px-3 py-1 rounded-lg uppercase tracking-wider animate-pulse flex items-center gap-1.5 shadow-lg shadow-amber-500/20">
                  🏆 CricTourney Champions League Dream XI 🏆
                </span>
              ) : (
                <span className="text-[9px] bg-amber-550/15 border border-amber-500/30 text-amber-450 font-extrabold px-2.5 py-0.5 rounded-lg uppercase tracking-wider">
                  🏆 Tournament Dream Team (Best XI)
                </span>
              )}
              <h3 className="text-base font-black text-slate-150 mt-1 tracking-tight">
                {isFinalCompleted ? '👑 CricTourney Ultimate Champions XI 👑' : 'Optimal Standings Dream XI'}
              </h3>
              <p className="text-[10.5px] text-slate-450 mt-0.5">
                {isFinalCompleted
                  ? 'The ultimate high-performing squad of CricTourney 2026. These players are the true champions of the fantasy league arena!'
                  : 'The absolute highest-scoring 11-player lineup based on real statistics. Updates live as matches progress.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
              {/* Toggle View */}
              <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-855">
                <button
                  onClick={() => setDreamTeamView('field')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                    dreamTeamView === 'field'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-450'
                      : 'border border-transparent text-slate-450 hover:text-slate-200'
                  }`}
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span>Field</span>
                </button>
                <button
                  onClick={() => setDreamTeamView('list')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                    dreamTeamView === 'list'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-455'
                      : 'border border-transparent text-slate-450 hover:text-slate-200'
                  }`}
                >
                  <List className="w-3 h-3" />
                  <span>List</span>
                </button>
              </div>

              {/* Dream Team Score */}
              <div className={`border py-1 px-3.5 rounded-xl text-center sm:text-left transition-all ${
                isFinalCompleted
                  ? 'bg-amber-955/80 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                  : 'bg-slate-955/80 border-slate-850'
              }`}>
                <span className="text-[7.5px] text-slate-550 font-black uppercase tracking-widest block">Dream Team Score</span>
                <span className={`text-sm font-black ${isFinalCompleted ? 'text-amber-300' : 'text-amber-400'}`}>{tournamentDreamTeam.totalPoints.toFixed(1)} pts</span>
              </div>
            </div>
          </div>

          {dreamTeamView === 'field' ? (
            /* Virtual Cricket Pitch Field */
            <div className={`relative w-full max-w-xl mx-auto aspect-[3/4] sm:aspect-[16/11] rounded-2xl overflow-hidden shadow-2xl select-none transition-all duration-500 ${
              isFinalCompleted
                ? 'border border-amber-500/40 bg-gradient-to-b from-emerald-900/45 via-amber-500/10 to-emerald-900/45 shadow-[inset_0_0_30px_rgba(245,158,11,0.25)]'
                : 'border border-emerald-950/80 bg-gradient-to-b from-emerald-900/35 via-emerald-950/20 to-emerald-900/35'
            }`}>
              {/* Turf details */}
              <div className="absolute inset-3 border border-emerald-500/5 rounded-xl pointer-events-none" />
              <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-emerald-500/5 pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-emerald-500/5 rounded-full pointer-events-none" />
              
              {/* Celebrate overlay */}
              {isFinalCompleted && (
                <>
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.1),transparent_75%)] pointer-events-none animate-pulse" />
                  {/* Sparkles */}
                  <div className="absolute top-10 left-10 text-xs animate-bounce pointer-events-none opacity-45 delay-75">✨</div>
                  <div className="absolute top-20 right-12 text-xs animate-bounce pointer-events-none opacity-35 delay-300">⭐</div>
                  <div className="absolute bottom-16 left-16 text-xs animate-bounce pointer-events-none opacity-40 delay-200">⭐</div>
                  <div className="absolute bottom-12 right-20 text-xs animate-bounce pointer-events-none opacity-50 delay-500">✨</div>
                </>
              )}

              {/* The Pitch strip */}
              <div className="absolute top-1/5 bottom-1/5 left-1/2 -translate-x-1/2 w-11 bg-amber-955/10 border-l border-r border-emerald-950/20 rounded-sm pointer-events-none flex flex-col justify-between py-2">
                <div className="h-0.5 w-full bg-slate-100/5" />
                <div className="h-0.5 w-full bg-slate-100/5" />
              </div>

              {/* Players on Pitch grouped by roles */}
              <div className="absolute inset-0 flex flex-col justify-between py-4 px-2 sm:px-4 z-10">
                {(() => {
                  const rolePriority = {
                    'Wicket Keeper': 1,
                    'Batter': 2,
                    'All-Rounder': 3,
                    'Bawler': 4
                  };
                  const sortedPlayersForPitch = [...tournamentDreamTeam.players].sort((a, b) => {
                    const prioA = rolePriority[a.role as keyof typeof rolePriority] || 99;
                    const prioB = rolePriority[b.role as keyof typeof rolePriority] || 99;
                    return prioA - prioB;
                  });

                  const row1 = sortedPlayersForPitch.slice(0, 1);
                  const row2 = sortedPlayersForPitch.slice(1, 4);
                  const row3 = sortedPlayersForPitch.slice(4, 7);
                  const row4 = sortedPlayersForPitch.slice(7, 11);

                  return [row1, row2, row3, row4].map((rowPlayers, rowIndex) => (
                    <div key={rowIndex} className="flex justify-center gap-1.5 sm:gap-6">
                      {rowPlayers.map(player => {
                        const isTopOverall = player.id === topPerformancePlayerId;
                        return (
                          <div key={player.id} className="flex flex-col items-center relative w-[54px] sm:w-20 shrink-0">
                            <div className="relative">
                              {isTopOverall && (
                                <>
                                  <div className="absolute -top-2.5 sm:-top-3.5 left-1/2 -translate-x-1/2 text-[9px] sm:text-[11px] animate-bounce z-30 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">👑</div>
                                  <div className="absolute inset-0 rounded-full bg-amber-500/25 animate-ping pointer-events-none" />
                                </>
                              )}
                              {player.photo ? (
                                <img
                                  src={getFileUrl('players', player.id, player.photo)}
                                  alt=""
                                  className={`w-7 h-7 sm:w-8.5 sm:h-8.5 rounded-full object-cover shadow-md transition-all ${
                                    isTopOverall
                                      ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-955 shadow-[0_0_15px_rgba(245,158,11,0.85)] border-amber-450'
                                      : isFinalCompleted
                                      ? 'ring-1 ring-amber-500/40 ring-offset-1 ring-offset-slate-900 border-amber-500/30'
                                      : 'border border-emerald-450/70'
                                  }`}
                                />
                              ) : (
                                <div className={`w-7 h-7 sm:w-8.5 sm:h-8.5 rounded-full bg-gradient-to-br border flex items-center justify-center text-[7px] sm:text-[9px] font-black uppercase shadow-md transition-all ${
                                  isTopOverall
                                    ? 'from-amber-400 to-yellow-500 border-amber-305 ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-955 shadow-[0_0_15px_rgba(245,158,11,0.85)] text-slate-955'
                                    : isFinalCompleted
                                    ? 'from-amber-600/40 to-yellow-750/30 border-amber-505 text-amber-200'
                                    : 'from-emerald-500 to-teal-650 border-emerald-555 text-white'
                                }`}>
                                  {player.name.substring(0, 2)}
                                </div>
                              )}
                              {player.id === tournamentDreamTeam.captainId && (
                                <span className="absolute -top-1 sm:-top-1.5 -right-1 sm:-right-1.5 bg-amber-500 text-slate-955 text-[5.5px] sm:text-[7.5px] font-black w-3 h-3 sm:w-4 sm:h-4 rounded-full flex items-center justify-center border border-slate-955 shadow-md">C</span>
                              )}
                              {player.id === tournamentDreamTeam.viceCaptainId && (
                                <span className="absolute -top-1 sm:-top-1.5 -right-1 sm:-right-1.5 bg-slate-350 text-slate-955 text-[5.5px] sm:text-[7.5px] font-black w-3 h-3 sm:w-4 sm:h-4 rounded-full flex items-center justify-center border border-slate-955 shadow-md">VC</span>
                              )}
                            </div>
                            <span className={`text-[7px] sm:text-[8.5px] font-extrabold mt-1 px-1 sm:px-2 py-0.1 sm:py-0.5 rounded-full shadow-sm truncate max-w-[50px] sm:max-w-[80px] transition-all ${
                              isTopOverall
                                ? 'text-amber-300 bg-amber-955/95 border border-amber-400 font-black scale-105 shadow-[0_2px_6px_rgba(245,158,11,0.3)]'
                                : isFinalCompleted
                                ? 'text-amber-200 bg-amber-955/80 border border-amber-500/30'
                                : 'text-slate-100 bg-slate-950/80 border border-slate-850'
                            }`}>
                              {player.name.split(' (')[0]}
                            </span>
                            <span className={`text-[6px] sm:text-[7px] font-bold bg-slate-950/85 px-1 sm:px-1.5 rounded-md mt-0.5 opacity-90 border transition-all ${
                              isTopOverall
                                ? 'text-amber-400 border-amber-500/40'
                                : isFinalCompleted
                                ? 'text-amber-300/85 border-amber-500/20'
                                : 'text-emerald-450 border-slate-900'
                            }`}>
                              {player.points} pts • {selectionMap[player.id]}%
                            </span>
                            {(() => {
                              const badge = getPlayerHighlightBadge(player.id);
                              if (!badge) return null;
                              return (
                                <span className={`inline-block text-[5px] sm:text-[6px] px-1 py-0.1 rounded mt-0.5 uppercase tracking-wider scale-80 sm:scale-90 ${badge.style}`}>
                                  {badge.text.replace('👑 ', '').replace('⚡ ', '').replace('🌟 ', '')}
                                </span>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
            </div>
          ) : (
            /* List View */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
              {(['Wicket Keeper', 'Batter', 'All-Rounder', 'Bawler'] as const).map((role) => {
                const rolePlayers = tournamentDreamTeam.players.filter(p => p.role === role);
                if (rolePlayers.length === 0) return null;
                
                return (
                  <div key={role} className="space-y-2 bg-slate-950/20 p-3 rounded-2xl border border-slate-900/60">
                    <div className="flex items-center justify-between border-b border-slate-905 pb-1.5 mb-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {role === 'Bawler' ? 'Bowlers' : role + 's'}
                      </span>
                      <span className="text-[9px] font-bold text-slate-500">
                        {rolePlayers.length} {rolePlayers.length === 1 ? 'Player' : 'Players'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                      {rolePlayers.map((player) => {
                        const isTopOverall = player.id === topPerformancePlayerId;
                        const badge = getPlayerHighlightBadge(player.id);
                        const playerTeam = teams.find(t => t.id === player.team);
                        return (
                          <div
                            key={player.id}
                            className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                              isTopOverall
                                ? 'bg-amber-955/10 border-amber-500/40 shadow-[inset_0_0_12px_rgba(245,158,11,0.05)]'
                                : 'bg-slate-900/45 border-slate-850/60 hover:border-slate-800'
                            }`}
                          >
                            {/* Photo / initials */}
                            <div className="relative shrink-0">
                              {player.photo ? (
                                <img
                                  src={getFileUrl('players', player.id, player.photo)}
                                  alt=""
                                  className={`w-9 h-9 rounded-full object-cover border ${
                                    isTopOverall ? 'border-amber-400 ring-1 ring-amber-400/40' : 'border-slate-800'
                                  }`}
                                />
                              ) : (
                                <div className={`w-9 h-9 rounded-full border flex items-center justify-center text-xs font-black uppercase ${
                                  isTopOverall ? 'bg-gradient-to-br from-amber-400 to-yellow-500 border-amber-305 text-slate-955' : 'bg-slate-800 border-slate-700 text-slate-350'
                                }`}>
                                  {player.name.substring(0, 2)}
                                </div>
                              )}
                              {player.id === tournamentDreamTeam.captainId && (
                                <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-955 text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border border-slate-950 shadow">C</span>
                              )}
                              {player.id === tournamentDreamTeam.viceCaptainId && (
                                <span className="absolute -top-1 -right-1 bg-slate-300 text-slate-955 text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border border-slate-950 shadow">VC</span>
                              )}
                            </div>
                            
                            {/* Player Info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[11px] font-extrabold truncate ${isTopOverall ? 'text-amber-300' : 'text-slate-200'}`}>
                                  {player.name.split(' (')[0]}
                                </span>
                                {isTopOverall && <span className="text-[10px] shrink-0">👑</span>}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[9px] text-slate-500 font-bold">
                                <span>{playerTeam?.short_name || 'Team'}</span>
                                <span>•</span>
                                <span className="text-emerald-450">{player.points} pts</span>
                              </div>
                              {badge && (
                                <span className={`inline-block text-[7px] px-1.5 py-0.2 rounded mt-1 uppercase tracking-wider font-extrabold scale-90 origin-left ${badge.style}`}>
                                  {badge.text.replace('👑 ', '').replace('⚡ ', '').replace('🌟 ', '')}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: My Team & Squad Builder (2 Columns width on LG) */}
        <div className="lg:col-span-2 space-y-6">
          {!myTeamId && (
            <div className="glass-panel p-6 rounded-3xl border border-amber-500/35 bg-gradient-to-r from-slate-950 via-amber-950/10 to-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.08)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="flex gap-4 items-start relative z-10">
                <div className="bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20 text-amber-400 shrink-0">
                  <BadgeInfo className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-black text-slate-150 tracking-tight flex items-center gap-1.5">
                    <span>🏏 What is Dream 11 & How to Play?</span>
                  </h4>
                  <p className="text-xs text-slate-405 leading-relaxed">
                    Select exactly <strong>11 players</strong> from the rosters to form your fantasy squad. 
                    Appoint a <strong>Captain (C)</strong> to earn <strong>2.0x points</strong>, and a <strong>Vice-Captain (VC)</strong> to earn <strong>1.5x points</strong>. 
                    Your squad accumulates points dynamically based on real-match performances like runs, wickets, dot balls, boundaries, and fielding contributions.
                  </p>
                  <div className="pt-2.5 border-t border-slate-900 mt-2.5 flex gap-3 items-start">
                    <ShieldAlert className="w-4 h-4 text-amber-550 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="text-[11px] font-black text-amber-400 block">Critical Device & Browser Notice</span>
                      <p className="text-[10.5px] text-slate-450 leading-relaxed">
                        To protect your privacy and avoid complex account registration, your squad is securely tied to this <strong>specific browser and device</strong> using your browser's hardware/software fingerprint. 
                        <span className="text-amber-300/90 font-medium"> Clearing your browser cache/cookies, using Private/Incognito browsing, or changing your device will result in losing access to manage your squad.</span> Please use the same browser and device to check your standing or make updates!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 bg-slate-950/20">
            <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-6">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-slate-100">Squad Builder</h3>
              </div>
              {isSquadLocked && (
                <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-3 py-1 rounded-lg text-xs font-semibold">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {isFinalStarted ? 'Squad Locked (Final Started)' : 'Squad Locked (Match Live)'}
                </div>
              )}
            </div>

            <form onSubmit={handleSaveTeam} className="space-y-6">
              {/* Squad Builder Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Fantasy Team Name</label>
                  <input
                    type="text"
                    disabled={isSquadLocked}
                    placeholder="e.g. Chamith's Challengers"
                    value={teamNameInput}
                    onChange={(e) => setTeamNameInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-850 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-100 placeholder-slate-650 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Owner Name</label>
                  <input
                    type="text"
                    disabled={isSquadLocked}
                    placeholder="e.g. Chamith"
                    value={ownerNameInput}
                    onChange={(e) => setOwnerNameInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-850 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-100 placeholder-slate-650 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Visual Selected Squad list */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Your 11-Player Squad</label>
                  <span className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wider">
                    Select Captain (C) & Vice-Captain (VC)
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-11 gap-2.5">
                  {Array.from({ length: 11 }).map((_, index) => {
                    const pId = selectedPlayerIds[index];
                    const player = pId ? players.find(p => p.id === pId) : null;
                    const team = player ? teams.find(t => t.id === player.team) : null;
                    const isCaptain = captainId === pId;
                    const isViceCaptain = viceCaptainId === pId;
                    const isMVP = pId === topPerformancePlayerId;

                    return (
                      <div
                        key={index}
                        className={`h-[135px] rounded-xl border flex flex-col justify-between p-2 relative transition-all ${
                          player
                            ? isMVP
                              ? 'bg-gradient-to-b from-slate-900 to-amber-955/20 border-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.25)] scale-105 z-10'
                              : isCaptain
                                ? 'bg-slate-900 border-amber-500/60 shadow-lg shadow-amber-550/5'
                                : isViceCaptain
                                  ? 'bg-slate-900 border-violet-500/60 shadow-lg shadow-violet-550/5'
                                  : 'bg-slate-900/80 border-slate-800 shadow-md'
                            : 'bg-slate-950/40 border-slate-900/60 border-dashed items-center justify-center'
                        }`}
                      >
                        {player ? (
                          <>
                            <div className="flex justify-between items-start gap-1">
                              <img
                                src={getTeamLogo(team)}
                                alt=""
                                className="w-5.5 h-5.5 object-contain opacity-75"
                              />
                              <div className="flex items-center gap-0.5">
                                {/* Captain Select */}
                                <button
                                  type="button"
                                  disabled={isSquadLocked}
                                  onClick={() => {
                                    if (isCaptain) {
                                      setCaptainId('');
                                    } else {
                                      setCaptainId(player.id);
                                      if (viceCaptainId === player.id) setViceCaptainId('');
                                    }
                                  }}
                                  className={`w-4 h-4 rounded-full text-[8.5px] font-black flex items-center justify-center transition-all cursor-pointer ${
                                    isCaptain
                                      ? 'bg-amber-500 text-slate-950 scale-105 shadow-md shadow-amber-500/20'
                                      : 'bg-slate-950 text-slate-500 hover:text-amber-400 hover:bg-slate-900'
                                  }`}
                                  title="Captain (2x pts)"
                                >
                                  C
                                </button>
                                {/* Vice Captain Select */}
                                <button
                                  type="button"
                                  disabled={isSquadLocked}
                                  onClick={() => {
                                    if (isViceCaptain) {
                                      setViceCaptainId('');
                                    } else {
                                      setViceCaptainId(player.id);
                                      if (captainId === player.id) setCaptainId('');
                                    }
                                  }}
                                  className={`w-4 h-4 rounded-full text-[8.5px] font-black flex items-center justify-center transition-all cursor-pointer ${
                                    isViceCaptain
                                      ? 'bg-violet-550 text-slate-950 scale-105 shadow-md shadow-violet-550/20'
                                      : 'bg-slate-950 text-slate-500 hover:text-violet-400 hover:bg-slate-900'
                                  }`}
                                  title="Vice-Captain (1.5x pts)"
                                >
                                  VC
                                </button>
                                {/* Remove Player */}
                                {!isSquadLocked && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedPlayerIds(prev => prev.filter(id => id !== player.id));
                                      if (captainId === player.id) setCaptainId('');
                                      if (viceCaptainId === player.id) setViceCaptainId('');
                                    }}
                                    className="text-slate-550 hover:text-rose-455 p-0.5 rounded transition-colors ml-0.5"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="mt-1 flex-1">
                              <span className={`text-[9px] font-black block tracking-tight truncate ${isMVP ? 'text-amber-400' : 'text-emerald-450'}`}>
                                {isMVP && '👑 '}{player.name.split(' (')[0]}
                              </span>
                              <span className="text-[7.5px] text-slate-500 font-bold block mt-0.5 truncate">
                                {player.role} • {team?.short_name}
                              </span>
                              {(() => {
                                const badge = getPlayerHighlightBadge(player.id);
                                if (!badge) return null;
                                return (
                                  <span className={`inline-block text-[6.5px] px-1.5 py-0.2 rounded mt-0.5 uppercase tracking-wide ${badge.style}`}>
                                    {badge.text}
                                  </span>
                                );
                              })()}
                            </div>
                            <div className="flex justify-between items-center mt-1 pt-1 border-t border-slate-950/60">
                              <span className="text-[7.5px] text-slate-555 font-semibold uppercase">Pts</span>
                              <span className={`text-[9.5px] font-black ${isMVP ? 'text-amber-300 font-extrabold' : 'text-slate-205'}`}>
                                {playerPointsMap[player.id] || 0}
                                {isCaptain && <span className="text-[7px] text-amber-500 ml-0.5">2x</span>}
                                {isViceCaptain && <span className="text-[7px] text-violet-455 ml-0.5">1.5x</span>}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="text-center text-slate-700 flex flex-col items-center justify-center gap-1 my-auto">
                            <span className="text-[9px] font-bold">Slot {index + 1}</span>
                            <span className="text-[7px] font-semibold leading-none">Pick Player</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Squad rules validator display */}
              <div className="bg-slate-950/60 border border-slate-900 rounded-2xl p-4 space-y-2">
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  Squad Composition Rules (Dream 11)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 pt-1 text-[11px] font-semibold">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-455">Selected Players (Exactly 11):</span>
                    <span className={isSquadComplete ? 'text-emerald-400' : 'text-slate-500'}>
                      {selectedPlayerIds.length} / 11
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-455">Max 10 players per Team:</span>
                    <span className={isOverTeamLimit ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                      {isOverTeamLimit ? 'Violated' : 'Pass'}
                    </span>
                  </div>
                  {isStrict ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-455">Wicket Keepers (1-4):</span>
                        <span className={hasWK ? 'text-emerald-400' : 'text-slate-500'}>
                          {countByRole['Wicket Keeper'] || 0} / 1-4
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-455">Batters (3-6):</span>
                        <span className={hasBatter ? 'text-emerald-400' : 'text-slate-500'}>
                          {countByRole['Batter'] || 0} / 3-6
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-455">All-Rounders (1-4):</span>
                        <span className={hasAR ? 'text-emerald-400' : 'text-slate-500'}>
                          {countByRole['All-Rounder'] || 0} / 1-4
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-455">Bowlers (3-6):</span>
                        <span className={hasBowler ? 'text-emerald-400' : 'text-slate-500'}>
                          {countByRole['Bawler'] || 0} / 3-6
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="sm:col-span-2 lg:col-span-2 bg-emerald-500/5 border border-emerald-500/10 p-2 rounded-xl text-emerald-400 text-center flex items-center justify-center text-[10px]">
                      🏏 Softball Mode: Select any 11 players regardless of role!
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-455">Captain (C) Selected:</span>
                    <span className={hasCaptain ? 'text-emerald-400' : 'text-slate-500'}>
                      {hasCaptain ? 'Pass' : 'Missing'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-455">Vice-Captain (VC) Selected:</span>
                    <span className={hasViceCaptain ? 'text-emerald-400' : 'text-slate-500'}>
                      {hasViceCaptain ? 'Pass' : 'Optional'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status and Save button */}
              {saveStatus !== 'idle' && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold ${
                    saveStatus === 'saving'
                      ? 'bg-slate-900/60 border-slate-800 text-slate-300'
                      : saveStatus === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  }`}
                >
                  {saveMessage}
                </div>
              )}

              {isSquadLocked ? (
                <div className="w-full bg-slate-900/50 border border-slate-850 text-slate-500 rounded-xl py-3 text-center text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-555" />
                  {isFinalStarted ? 'Locked permanently (Final Started)' : 'Locked (Match Live)'}
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={saveStatus === 'saving' || !isValidSquad}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black rounded-xl py-3 text-sm tracking-wide shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 hover:brightness-105 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Save className="w-4 h-4" />
                  {myTeamId ? 'Update My Fantasy Squad' : 'Submit My Fantasy Squad'}
                </button>
              )}
            </form>
          </div>

          {/* Scout / Player List Table */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 bg-slate-950/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-slate-100">Player Scout Table</h3>
              </div>
              <div className="flex items-center gap-2 self-stretch sm:self-auto">
                {/* Search */}
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search player, team, role..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-850 pl-9 pr-4 py-2 rounded-lg text-xs font-semibold text-slate-200 placeholder-slate-550 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                {/* Role select */}
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-850 px-3 py-2 rounded-lg text-xs font-bold text-slate-300 focus:outline-none"
                >
                  <option value="All">All Roles</option>
                  <option value="Batter">Batters</option>
                  <option value="Bawler">Bawlers</option>
                  <option value="All-Rounder">All-Rounders</option>
                  <option value="Wicket Keeper">Keepers</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[500px] pr-1 w-full">
              <table className="w-full min-w-[480px] border-collapse text-left relative">
                <thead className="sticky top-0 bg-slate-950 z-10">
                  <tr className="border-b border-slate-900 text-[10px] text-slate-500 font-black uppercase tracking-wider">
                    <th className="py-2.5 pl-3">Player</th>
                    <th className="py-2.5">Team</th>
                    <th className="py-2.5">Role</th>
                    <th className="py-2.5 text-right">Selection %</th>
                    <th className="py-2.5 text-right">Fantasy Points</th>
                    {!isSquadLocked && <th className="py-2.5 pr-3 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60 text-xs font-semibold text-slate-300">
                  {filteredPlayers.map((player) => {
                    const team = teams.find(t => t.id === player.team);
                    const pts = playerPointsMap[player.id] || 0;
                    const isSelected = selectedPlayerIds.includes(player.id);
                    const isMaxSelected = selectedPlayerIds.length >= 11;
                    const isMVP = player.id === topPerformancePlayerId;

                    return (
                      <tr 
                        key={player.id} 
                        className={`transition-colors border-l-2 border-b border-slate-900/60 ${
                          isMVP 
                            ? 'bg-amber-500/5 hover:bg-amber-500/10 border-l-amber-500' 
                            : 'hover:bg-slate-900/20 border-l-transparent'
                        }`}
                      >
                        <td className={`py-3 pl-3 font-bold ${isMVP ? 'text-amber-300 font-extrabold' : 'text-slate-202'}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                            <span>{isMVP ? '👑 ' : ''}{player.name}</span>
                            {(() => {
                              const badge = getPlayerHighlightBadge(player.id);
                              if (!badge) return null;
                              return (
                                <span className={`inline-block text-[8px] px-1.5 py-0.5 rounded uppercase tracking-wider ${badge.style}`}>
                                  {badge.text}
                                </span>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <img src={getTeamLogo(team)} className="w-4 h-4 object-contain" />
                            <span>{team?.short_name}</span>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            player.role === 'Batter'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : player.role === 'Bawler'
                              ? 'bg-blue-500/10 text-blue-400'
                              : player.role === 'All-Rounder'
                              ? 'bg-violet-500/10 text-violet-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {player.role}
                          </span>
                        </td>
                        <td className="py-3 text-right font-black text-slate-400">
                          {selectionMap[player.id] || 0}%
                        </td>
                        <td className={`py-3 text-right font-black ${isMVP ? 'text-amber-400' : 'text-slate-100'}`}>{pts} pts</td>
                        {!isSquadLocked && (
                          <td className="py-3 pr-3 text-center">
                            <button
                              type="button"
                              onClick={() => togglePlayerSelection(player)}
                              disabled={!isSelected && isMaxSelected}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
                                  : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-30 disabled:pointer-events-none'
                              }`}
                            >
                              {isSelected ? 'Remove' : 'Pick Player'}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {filteredPlayers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-500 font-bold">
                        No players matched your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Global Standings / Leaderboard */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 bg-slate-950/20 flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center gap-2.5 border-b border-slate-900 pb-4 mb-4">
                <Trophy className="w-5 h-5 text-amber-400 animate-pulse" />
                <h3 className="text-lg font-bold text-slate-100">Global Standings</h3>
              </div>

              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                {leaderboard.map((entry, index) => {
                  const isMyTeam = entry.id === myTeamId;
                  const rank = index + 1;

                  return (
                    <div
                      key={entry.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isMyTeam
                          ? 'bg-gradient-to-r from-emerald-950/20 to-slate-900 border-emerald-500/30 shadow-md shadow-emerald-500/5'
                          : 'bg-slate-900/40 border-slate-850 hover:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Rank badge */}
                          <span className={`w-6 h-6 rounded-lg font-black text-[10px] flex items-center justify-center shrink-0 ${
                            rank === 1
                              ? 'bg-amber-400 text-slate-950'
                              : rank === 2
                              ? 'bg-slate-350 text-slate-950'
                              : rank === 3
                              ? 'bg-amber-700 text-slate-950'
                              : 'bg-slate-850 text-slate-400'
                          }`}>
                            {rank}
                          </span>
                          <div className="min-w-0">
                            <span className={`text-xs font-black block truncate ${isMyTeam ? 'text-emerald-300' : 'text-slate-200'}`}>
                              {entry.name}
                            </span>
                            <span className="text-[9px] text-slate-500 font-bold block truncate">
                              Owner: {entry.owner_name}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-slate-100 block">
                            {entry.totalPoints} pts
                          </span>
                          <span className="text-[8px] text-slate-500 block font-bold">
                            {(entry.players || []).length} players
                          </span>
                        </div>
                      </div>
                      
                      {/* List player initials/names in small line */}
                      <div className="mt-2.5 pt-2 border-t border-slate-950/50 flex flex-wrap gap-1.5 text-[9px] text-slate-400 font-medium">
                        {(entry.expand?.players || []).map((p, idx) => {
                          const isC = p.id === entry.captain;
                          const isVc = p.id === entry.vice_captain;
                          const isMVP = p.id === topPerformancePlayerId;
                          
                          let tagStyle = 'bg-slate-900/90 border-slate-800/80 text-slate-400';
                          if (isMVP) {
                            tagStyle = 'bg-amber-500/15 text-amber-300 border-amber-500/40 font-extrabold shadow-sm shadow-amber-550/10';
                          } else if (isC) {
                            tagStyle = 'bg-amber-500/10 text-amber-300 border-amber-500/35 font-bold shadow-sm shadow-amber-500/5';
                          } else if (isVc) {
                            tagStyle = 'bg-violet-550/15 text-violet-300 border-violet-550/35 font-bold shadow-sm shadow-violet-550/5';
                          }

                          return (
                            <span
                              key={p.id || idx}
                              className={`px-1.5 py-0.5 rounded text-[8px] truncate max-w-[95px] border transition-all ${tagStyle}`}
                            >
                              {isMVP ? '👑 ' : ''}{p.name.split(' (')[0]}{isC ? ' (C)' : isVc ? ' (VC)' : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {leaderboard.length === 0 && (
                  <div className="text-center py-12 text-slate-500 font-bold border border-dashed border-slate-850 rounded-2xl">
                    No fantasy teams created yet. Be the first to build a squad!
                  </div>
                )}
              </div>
            </div>

            {/* Quick point rules panel */}
            <div className="bg-slate-950/60 border border-slate-900 rounded-2xl p-4 space-y-2 mt-6">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider flex items-center gap-1.5">
                <BadgeInfo className="w-3.5 h-3.5 text-slate-400" />
                Quick Scoring Formula
              </span>
              <ul className="text-[10px] text-slate-400 space-y-1.5 leading-relaxed list-disc list-inside font-semibold">
                <li>Batting: 1 pt/run, 1 pt/four, 2 pt/six, 10 pt/fifty.</li>
                <li>Bowling: 25 pt/wicket, 1 pt/dot, 10 pt/3-wickets.</li>
                <li>Fielding: 8 pt/catch or stumping, 6 pt/runout.</li>
                <li>Penalty: -5 pts for batting ducks.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
