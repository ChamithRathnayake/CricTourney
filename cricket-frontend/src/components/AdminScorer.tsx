import React, { useState, useEffect } from 'react';
import { pb, getFileUrl, getTeamLogo, getUserRole } from '../services/pocketbase';
import type { Match, Team, Player, Inning, Delivery, News, TournamentConfig } from '../services/pocketbase';
import { Settings, Play, Disc, RotateCcw, AlertTriangle, CheckCircle, Plus, Users, Edit, Trash2, Upload, FileSpreadsheet, X, Trophy, Check, Loader2, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseStage, getStageName, getRoundName, getOrdinal } from '../services/bracketUtils';


interface DragScrollContainerProps {
  children: React.ReactNode;
  className?: string;
}

const DragScrollContainer: React.FC<DragScrollContainerProps> = ({ children, className = '' }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isDown, setIsDown] = React.useState(false);
  const [startX, setStartX] = React.useState(0);
  const [scrollLeft, setScrollLeft] = React.useState(0);

  React.useEffect(() => {
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

interface AdminScorerProps {
  matches: Match[];
  teams: Team[];
  players: Player[];
  refreshData: () => void;
  tournamentConfig: TournamentConfig | null;
}

export const AdminScorer: React.FC<AdminScorerProps> = ({ matches, teams, players, refreshData, tournamentConfig }) => {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [innings, setInnings] = useState<Inning[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  
  // Dynamically calculate rounds
  const totalRounds = matches.length > 0 
    ? Math.max(...matches.map(m => parseStage(m.stage).round), 1) 
    : 1;

  // Get user role
  const role = getUserRole();

  // Scorer vs Manage view toggle
  const [subView, setSubView] = useState<'scorer' | 'manage' | 'draw' | 'news'>(role === 'news' ? 'news' : 'scorer');
  
  // Enforce role subview restriction
  const activeSubView = role === 'superuser' ? subView : (role === 'news' ? 'news' : 'scorer');

  useEffect(() => {
    setSubView(role === 'news' ? 'news' : 'scorer');
  }, [role]);

  // User Management State
  const [portalUsers, setPortalUsers] = useState<any[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'scorer' | 'news' | 'display'>('scorer');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Add Team Form State
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamShortName, setNewTeamShortName] = useState('');
  const [newTeamLogo, setNewTeamLogo] = useState<File | null>(null);

  // Add Player Form State
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerRole, setNewPlayerRole] = useState<'Batter' | 'Bawler' | 'All-Rounder' | 'Wicket Keeper'>('Batter');
  const [newPlayerTeamId, setNewPlayerTeamId] = useState('');
  const [newPlayerPhoto, setNewPlayerPhoto] = useState<File | null>(null);
  const [newPlayerEpf, setNewPlayerEpf] = useState('');

  // Edit Team Modal State
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamShortName, setEditTeamShortName] = useState('');
  const [editTeamLogo, setEditTeamLogo] = useState<File | null>(null);
  const [editTeamCaptainId, setEditTeamCaptainId] = useState('');

  // Edit Player Modal State
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editPlayerName, setEditPlayerName] = useState('');
  const [editPlayerRole, setEditPlayerRole] = useState<'Batter' | 'Bawler' | 'All-Rounder' | 'Wicket Keeper'>('Batter');
  const [editPlayerTeamId, setEditPlayerTeamId] = useState('');
  const [editPlayerPhoto, setEditPlayerPhoto] = useState<File | null>(null);
  const [editPlayerEpf, setEditPlayerEpf] = useState('');

  // View Roster state (filtering players by team)
  const [rosterTeamId, setRosterTeamId] = useState<string>('');

  // Setup State
  const [team1Squad, setTeam1Squad] = useState<string[]>([]);
  const [team2Squad, setTeam2Squad] = useState<string[]>([]);
  const [battingFirst, setBattingFirst] = useState<string>(''); // Team ID
  const [strikerId, setStrikerId] = useState<string>('');
  const [nonStrikerId, setNonStrikerId] = useState<string>('');
  const [bowlerId, setBowlerId] = useState<string>('');
  const [oversLimit, setOversLimit] = useState<number>(5);

  // Wicket Modal State
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [dismissalType, setDismissalType] = useState<'Bawled' | 'Catch' | 'Run Out' | 'Stumped' | 'Hit Wicket' | 'Retired Out'>('Bawled');
  const [outPlayerId, setOutPlayerId] = useState<string>('');
  const [fielderId, setFielderId] = useState<string>('');
  const [runoutCompletedRuns, setRunoutCompletedRuns] = useState<number>(0);
  const [runoutExtraType, setRunoutExtraType] = useState<'None' | 'Wide' | 'No Ball' | 'Bye' | 'Leg Bye'>('None');

  // Custom Extras state
  const [selectedExtra, setSelectedExtra] = useState<'Wide' | 'No Ball' | 'Bye' | 'Leg Bye'>('Wide');
  const [extraRuns, setExtraRuns] = useState<number>(0);
  const [noBallRunsType, setNoBallRunsType] = useState<'Off Bat' | 'Byes'>('Off Bat');
  const [runoutNoBallType, setRunoutNoBallType] = useState<'Off Bat' | 'Byes'>('Off Bat');
  const [forceExtraBall, setForceExtraBall] = useState(false);

  // Setup UI loading/error
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showScorerErrorModal, setShowScorerErrorModal] = useState(false);
  const [scorerErrorMsg, setScorerErrorMsg] = useState('');

  // Custom overs states
  const [isCustomOvers, setIsCustomOvers] = useState(false);
  const [customOversVal, setCustomOversVal] = useState<string>('5');
  const [showSOBattingFirstSelectModal, setShowSOBattingFirstSelectModal] = useState(false);
  const [soSelectMatch, setSoSelectMatch] = useState<Match | null>(null);
  const [soRoundNumToCreate, setSoRoundNumToCreate] = useState(1);

  // News management states
  const [news, setNews] = useState<News[]>([]);
  const [newsHeadline, setNewsHeadline] = useState('');
  const [newsDescription, setNewsDescription] = useState('');
  const [isPostingNews, setIsPostingNews] = useState(false);
  const [editingNews, setEditingNews] = useState<News | null>(null);
  const [editNewsHeadline, setEditNewsHeadline] = useState('');
  const [editNewsDescription, setEditNewsDescription] = useState('');
  const [editNewsExistingPhotos, setEditNewsExistingPhotos] = useState<string[]>([]);
  const [editNewsNewPhotos, setEditNewsNewPhotos] = useState<File[]>([]);
  const [isSavingNews, setIsSavingNews] = useState(false);

  // Tournament Config states (Man of the Series)
  const [mosPlayerId, setMosPlayerId] = useState('');
  const [mosPerformance, setMosPerformance] = useState('');
  const [showEpfNumber, setShowEpfNumber] = useState(false);
  const [strictFantasyRoles, setStrictFantasyRoles] = useState(true);
  const [statsFromPhase, setStatsFromPhase] = useState<'All' | 'Quarter Finals' | 'Semi Finals'>('All');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isInitializingBracket, setIsInitializingBracket] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (tournamentConfig) {
      setMosPlayerId(tournamentConfig.man_of_the_series || '');
      setMosPerformance(tournamentConfig.mos_performance || '');
      setShowEpfNumber(!!tournamentConfig.show_epf_number);
      setStrictFantasyRoles(tournamentConfig.strict_fantasy_roles !== false);
      setStatsFromPhase(tournamentConfig.stats_from_phase || 'All');
    }
  }, [tournamentConfig]);

  // Match delay states
  const [delayPreset, setDelayPreset] = useState<string>('None');
  const [customDelay, setCustomDelay] = useState<string>('');

  useEffect(() => {
    if (selectedMatch) {
      const currentDelay = selectedMatch.delay_reason || '';
      if (!currentDelay) {
        setDelayPreset('None');
        setCustomDelay('');
      } else if (currentDelay === 'Match delayed due to rain 🌧️') {
        setDelayPreset('Rain');
        setCustomDelay('');
      } else if (currentDelay === 'Match delayed due to bad light ⛅') {
        setDelayPreset('Bad Light');
        setCustomDelay('');
      } else if (currentDelay === 'Match delayed due to wet outfield 💧') {
        setDelayPreset('Wet Outfield');
        setCustomDelay('');
      } else if (currentDelay === 'Match delayed due to technical issue ⚙️') {
        setDelayPreset('Technical');
        setCustomDelay('');
      } else {
        setDelayPreset('Other');
        setCustomDelay(currentDelay);
      }
    }
  }, [selectedMatch]);

  const handleUpdateDelay = async (reason: string) => {
    if (!selectedMatch) return;
    try {
      const updated = await pb.collection('matches').update<Match>(selectedMatch.id, {
        delay_reason: reason.trim()
      });
      setSelectedMatch(updated);
      refreshData();
      setSuccessMsg(reason.trim() ? `Match delay updated: "${reason}"` : 'Match delay cleared.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update delay status.');
    }
  };

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void | Promise<void>;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  } | null>(null);

  const triggerConfirm = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    options?: { confirmText?: string; cancelText?: string; isDanger?: boolean; onCancel?: () => void | Promise<void> }
  ) => {
    setConfirmModalConfig({
      title,
      message,
      onConfirm,
      onCancel: options?.onCancel,
      confirmText: options?.confirmText || 'Confirm',
      cancelText: options?.cancelText || 'Cancel',
      isDanger: options?.isDanger || false
    });
    setShowConfirmModal(true);
  };

  // Draw Designer local state map
  const [selectedDrawTeams, setSelectedDrawTeams] = useState<Record<string, { team1: string; team2: string }>>({});
  const [selectedByeTeams, setSelectedByeTeams] = useState<string[]>([]);

  const handleRandomizeByes = () => {
    const N = teams.length;
    let P = 2;
    while (P < N) {
      P *= 2;
    }
    const numByes = P - N;
    if (numByes <= 0) return;

    const teamList = [...teams];
    for (let i = teamList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [teamList[i], teamList[j]] = [teamList[j], teamList[i]];
    }
  };

  // Lock body scroll when modals are open
  useEffect(() => {
    const isModalOpen = !!editingTeam || !!editingPlayer || !!editingNews || showWicketModal || showConfirmModal || showScorerErrorModal;
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [editingTeam, editingPlayer, editingNews, showWicketModal, showConfirmModal, showScorerErrorModal]);

  useEffect(() => {
    const initialMap: Record<string, { team1: string; team2: string }> = {};
    matches.forEach(m => {
      initialMap[m.id] = {
        team1: m.team1 || '',
        team2: m.team2 || ''
      };
    });
    setSelectedDrawTeams(initialMap);
  }, [matches]);

  const handleDrawTeamChange = (matchId: string, slot: 'team1' | 'team2', teamId: string) => {
    setSelectedDrawTeams(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [slot]: teamId
      }
    }));
  };

  const activeInning = innings[innings.length - 1];

  const fetchMatchInnings = async (matchId: string, isInitialLoad = false) => {
    try {
      const currentMatchObj = matches.find(m => m.id === matchId);
      // 1. Synchronously load squad from local storage first to prevent render race conditions
      const saved = localStorage.getItem(`squad_${matchId}`);
      let currentT1Squad: string[] = [];
      let currentT2Squad: string[] = [];
      let currentBatFirst = '';
      let currentStriker = '';
      let currentNonStriker = '';
      let currentBowler = '';

      if (saved) {
        try {
          const { t1Squad, t2Squad, batFirst, strikerId, nonStrikerId, bowlerId } = JSON.parse(saved);
          currentT1Squad = t1Squad || [];
          currentT2Squad = t2Squad || [];
          currentBatFirst = batFirst || '';
          currentStriker = strikerId || '';
          currentNonStriker = nonStrikerId || '';
          currentBowler = bowlerId || '';
        } catch (err) {
          console.error('Error loading saved squad:', err);
        }
      }

      const list = await pb.collection('innings').getFullList<Inning>({
        filter: `match = "${matchId}"`,
        sort: '+created'
      });

      if (list.length > 0) {
        const inningIds = list.map(i => i.id);
        const filterStr = inningIds.map(id => `inning = "${id}"`).join(' || ');
        const delList = await pb.collection('deliveries').getFullList<Delivery>({
          filter: filterStr,
          sort: '+created',
          expand: 'striker,bawler,out_player,fielder'
        });

        // Deduce squads from deliveries if not in localStorage
        if (currentT1Squad.length === 0 && delList.length > 0) {
          const t1Set = new Set<string>();
          const t2Set = new Set<string>();
          delList.forEach(d => {
            if (d.striker) {
              const p = players.find(x => x.id === d.striker);
              if (p) {
                if (p.team === currentMatchObj?.team1) t1Set.add(p.id);
                else if (p.team === currentMatchObj?.team2) t2Set.add(p.id);
              }
            }
            if (d.bawler) {
              const p = players.find(x => x.id === d.bawler);
              if (p) {
                if (p.team === currentMatchObj?.team1) t1Set.add(p.id);
                else if (p.team === currentMatchObj?.team2) t2Set.add(p.id);
              }
            }
            if (d.out_player) {
              const p = players.find(x => x.id === d.out_player);
              if (p) {
                if (p.team === currentMatchObj?.team1) t1Set.add(p.id);
                else if (p.team === currentMatchObj?.team2) t2Set.add(p.id);
              }
            }
          });
          currentT1Squad = Array.from(t1Set);
          currentT2Squad = Array.from(t2Set);
        }

        // Apply squads and batting first synchronously before updating innings
        if (currentT1Squad.length > 0) setTeam1Squad(currentT1Squad);
        if (currentT2Squad.length > 0) setTeam2Squad(currentT2Squad);
        if (currentBatFirst) setBattingFirst(currentBatFirst);

        setDeliveries(delList);
        setInnings(list); // Set innings last to prevent early view switch

        // Auto-populate active batters/bowlers from the last delivery ONLY on initial load
        const activeInn = list[list.length - 1];
        setBattingFirst(activeInn.batting_team); // Ensure battingFirst is set when resuming!
        
        if (list.length > 2) {
          setOversLimit(1);
        } else if (currentMatchObj?.overs_limit) {
          setOversLimit(currentMatchObj.overs_limit);
        }

        const activeDel = delList.filter(d => d.inning === activeInn.id);
        if (isInitialLoad) {
          if (activeDel.length > 0) {
            const lastDel = activeDel[activeDel.length - 1];
            const validStriker = currentStriker && players.find(p => p.id === currentStriker)?.team === activeInn.batting_team ? currentStriker : lastDel.striker;
            const validBowler = currentBowler && players.find(p => p.id === currentBowler)?.team === activeInn.bawling_team ? currentBowler : lastDel.bawler;

            setStrikerId(validStriker);
            setBowlerId(validBowler);

            if (currentNonStriker && players.find(p => p.id === currentNonStriker)?.team === activeInn.batting_team) {
              setNonStrikerId(currentNonStriker);
            } else {
              const diffStriker = activeDel.slice().reverse().find(d => d.striker && d.striker !== lastDel.striker);
              if (diffStriker) {
                const isOut = activeDel.some(d => d.is_wicket && d.out_player === diffStriker.striker);
                if (!isOut) {
                  setNonStrikerId(diffStriker.striker);
                } else {
                  setNonStrikerId('');
                }
              } else {
                setNonStrikerId('');
              }
            }
          } else {
            // New inning with 0 deliveries - reset players unless they match the active inning teams
            setStrikerId(currentStriker && players.find(p => p.id === currentStriker)?.team === activeInn.batting_team ? currentStriker : '');
            setNonStrikerId(currentNonStriker && players.find(p => p.id === currentNonStriker)?.team === activeInn.batting_team ? currentNonStriker : '');
            setBowlerId(currentBowler && players.find(p => p.id === currentBowler)?.team === activeInn.bawling_team ? currentBowler : '');
          }
        }
      } else {
        setDeliveries([]);
        setInnings([]);
      }
    } catch (err) {
      console.error('Error fetching match innings:', err);
    }
  };

  useEffect(() => {
    if (selectedMatch) {
      fetchMatchInnings(selectedMatch.id, true); // initial load
    } else {
      setInnings([]);
      setDeliveries([]);
    }
  }, [selectedMatch]);

  // Persist squad and crease state to local storage
  useEffect(() => {
    if (selectedMatch && (team1Squad.length > 0 || team2Squad.length > 0)) {
      localStorage.setItem(`squad_${selectedMatch.id}`, JSON.stringify({
        t1Squad: team1Squad,
        t2Squad: team2Squad,
        batFirst: battingFirst,
        strikerId: strikerId,
        nonStrikerId: nonStrikerId,
        bowlerId: bowlerId
      }));
    }
  }, [team1Squad, team2Squad, battingFirst, strikerId, nonStrikerId, bowlerId, selectedMatch]);

  // Save squads to PocketBase DB in real-time when changed by admin
  useEffect(() => {
    if (selectedMatch && selectedMatch.status === 'Live' && (team1Squad.length > 0 || team2Squad.length > 0)) {
      const syncSquads = async () => {
        try {
          await pb.collection('matches').update(selectedMatch.id, {
            team1_squad: team1Squad,
            team2_squad: team2Squad
          });
        } catch (err) {
          console.error("Failed to sync squads with DB:", err);
        }
      };
      syncSquads();
    }
  }, [team1Squad, team2Squad, selectedMatch]);

  const getTeam = (teamId: string) => teams.find(t => t.id === teamId);
  const getPlayer = (playerId: string) => players.find(p => p.id === playerId);
  const formatPlayerName = (playerOrId: Player | string | null | undefined, options?: { showCaptainSymbol?: boolean; teamId?: string }) => {
    if (!playerOrId) return '';
    const player = typeof playerOrId === 'string' ? getPlayer(playerOrId) : playerOrId;
    if (!player) return typeof playerOrId === 'string' ? playerOrId : '';
    
    let name = player.name;
    if (tournamentConfig?.show_epf_number && player.epf_number) {
      name = `${player.name} - ${player.epf_number}`;
    }
    if (options?.showCaptainSymbol) {
      const team = teams.find(t => t.id === (options.teamId || player.team));
      if (team && team.captain === player.id) {
        name = `${name} (C)`;
      }
    }
    return name;
  };
  const getTeamPlayers = (teamId: string) => players.filter(p => p.team === teamId);

  const getPlayersByGroup = (teamId: string) => {
    const allTeamPlayers = players.filter(p => p.team === teamId);
    const squad = teamId === selectedMatch?.team1 ? team1Squad : team2Squad;
    
    if (squad.length === 0) {
      return {
        playing: allTeamPlayers,
        bench: []
      };
    }
    
    const playing = allTeamPlayers.filter(p => squad.includes(p.id));
    const bench = allTeamPlayers.filter(p => !squad.includes(p.id));
    
    return { playing, bench };
  };

  // Set default roster selection to first team if not selected
  useEffect(() => {
    if (teams.length > 0 && !rosterTeamId) {
      setRosterTeamId(teams[0].id);
    }
  }, [teams]);

  const fetchNewsList = async () => {
    try {
      const records = await pb.collection('news').getFullList<News>({
        sort: '-created'
      });
      setNews(records);
    } catch (err: any) {
      console.error('Error fetching news:', err);
    }
  };

  useEffect(() => {
    fetchNewsList();
  }, []);

  const fetchPortalUsers = async () => {
    try {
      const records = await pb.collection('users').getFullList({
        sort: '-created'
      });
      setPortalUsers(records);
    } catch (err) {
      console.error('Error fetching portal users:', err);
    }
  };

  useEffect(() => {
    if (role === 'superuser') {
      fetchPortalUsers();
    }
  }, [role]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserUsername.trim() || !newUserPassword.trim()) {
      setErrorMsg('All fields are required to create a user.');
      return;
    }
    
    // Clean username (alphanumeric only, lowercase)
    const cleanUsername = newUserUsername.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanUsername) {
      setErrorMsg('Invalid username. Use only alphanumeric characters.');
      return;
    }

    const email = `${cleanUsername}.${newUserRole}@crictourney.online`;

    setIsCreatingUser(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await pb.collection('users').create({
        username: cleanUsername,
        email: email,
        password: newUserPassword,
        passwordConfirm: newUserPassword,
        name: newUserName,
        emailVisibility: true
      });

      setSuccessMsg(`User "${newUserName}" created successfully! Email: ${email}`);
      setNewUserName('');
      setNewUserUsername('');
      setNewUserPassword('');
      fetchPortalUsers();
    } catch (err: any) {
      console.error('Error creating user:', err);
      setErrorMsg(err.message || 'Failed to create user. Email or username might already be in use.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    triggerConfirm(
      'Delete User Account',
      `Are you sure you want to delete user account "${userName}"? This cannot be undone.`,
      async () => {
        setErrorMsg('');
        setSuccessMsg('');
        try {
          await pb.collection('users').delete(userId);
          setSuccessMsg(`User account "${userName}" deleted successfully.`);
          fetchPortalUsers();
        } catch (err: any) {
          console.error('Error deleting user:', err);
          setErrorMsg(err.message || 'Failed to delete user.');
        }
      },
      { isDanger: true }
    );
  };

  const handlePostNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsHeadline.trim()) {
      setErrorMsg('Headline is required.');
      return;
    }
    setIsPostingNews(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const formData = new FormData();
      formData.append('headline', newsHeadline);
      formData.append('description', newsDescription);

      const fileInput = document.getElementById('news-photos-input') as HTMLInputElement;
      if (fileInput && fileInput.files) {
        for (let i = 0; i < fileInput.files.length; i++) {
          formData.append('photos', fileInput.files[i]);
        }
      }

      await pb.collection('news').create(formData);
      setNewsHeadline('');
      setNewsDescription('');
      if (fileInput) fileInput.value = '';
      
      setSuccessMsg('News article posted successfully!');
      fetchNewsList();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error posting news article.');
    } finally {
      setIsPostingNews(false);
    }
  };

  const handleStartEditNews = (article: News) => {
    setEditingNews(article);
    setEditNewsHeadline(article.headline);
    setEditNewsDescription(article.description || '');
    setEditNewsExistingPhotos(article.photos || []);
    setEditNewsNewPhotos([]);
  };

  const handleEditNewsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNews) return;
    if (!editNewsHeadline.trim()) {
      setErrorMsg('Headline is required.');
      return;
    }

    setIsSavingNews(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const formData = new FormData();
      formData.append('headline', editNewsHeadline);
      formData.append('description', editNewsDescription);

      // Append existing photos we want to keep
      editNewsExistingPhotos.forEach((photo) => {
        formData.append('photos', photo);
      });

      // Append newly uploaded photos
      editNewsNewPhotos.forEach((file) => {
        formData.append('photos', file);
      });

      await pb.collection('news').update(editingNews.id, formData);
      setEditingNews(null);
      setSuccessMsg('News article updated successfully!');
      fetchNewsList();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating news article.');
    } finally {
      setIsSavingNews(false);
    }
  };

  const handleDeleteNews = async (id: string) => {
    triggerConfirm(
      'Delete News Article',
      'Are you sure you want to delete this news article?',
      async () => {
        try {
          await pb.collection('news').delete(id);
          setSuccessMsg('News article deleted successfully.');
          fetchNewsList();
        } catch (err: any) {
          setErrorMsg(err.message || 'Error deleting news article.');
        }
      },
      { isDanger: true }
    );
  };

  const handleSaveTournamentConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const data = {
        man_of_the_series: mosPlayerId || null,
        mos_performance: mosPerformance.trim() || '',
        show_epf_number: showEpfNumber,
        strict_fantasy_roles: strictFantasyRoles,
        stats_from_phase: statsFromPhase
      };

      if (tournamentConfig) {
        await pb.collection('tournament_config').update(tournamentConfig.id, data);
      } else {
        await pb.collection('tournament_config').create(data);
      }

      setSuccessMsg('Tournament configuration saved successfully!');
      refreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving tournament configuration.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleInitializeBracket = async () => {
    setIsInitializingBracket(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const N = teams.length;
      if (N < 2) {
        throw new Error('At least 2 teams are required to generate a tournament bracket.');
      }

      // 1. Delete all existing deliveries, innings, and matches (fresh start)
      const existingMatches = await pb.collection('matches').getFullList({ fields: 'id', requestKey: null });
      for (const m of existingMatches) {
        const existingInnings = await pb.collection('innings').getFullList({
          filter: `match = "${m.id}"`,
          fields: 'id',
          requestKey: null
        });
        for (const inn of existingInnings) {
          const existingDeliveries = await pb.collection('deliveries').getFullList({
            filter: `inning = "${inn.id}"`,
            fields: 'id',
            requestKey: null
          });
          for (const del of existingDeliveries) {
            await pb.collection('deliveries').delete(del.id, { requestKey: null });
          }
          await pb.collection('innings').delete(inn.id, { requestKey: null });
        }
        await pb.collection('matches').delete(m.id, { requestKey: null });
      }

      // 2. Find next power of 2
      let P = 2;
      while (P < N) {
        P *= 2;
      }

      const roundsCount = Math.log2(P);
      const numByes = P - N;

      if (numByes > 0 && selectedByeTeams.length !== numByes) {
        throw new Error(`Exactly ${numByes} bye teams must be selected.`);
      }

      // 3. Create all empty match records across all rounds
      const createdMatchesMap: Record<string, string> = {};

      for (let r = roundsCount; r >= 1; r--) {
        const numMatchesInRound = Math.pow(2, r - 1);
        for (let m = 1; m <= numMatchesInRound; m++) {
          const stageName = getStageName(r, m);
          const matchRecord = await pb.collection('matches').create({
            stage: stageName,
            status: 'Upcoming',
            team1: null,
            team2: null,
            winner: null,
            overs_limit: 5,
            match_time: ''
          }, { requestKey: null });
          createdMatchesMap[`${r}_${m}`] = matchRecord.id;
        }
      }

      // 4. Distribute teams to Round 1 matches
      const byeTeams = teams.filter(t => selectedByeTeams.includes(t.id));
      const nonByeTeams = teams.filter(t => !selectedByeTeams.includes(t.id));

      const randomizedNonByes = [...nonByeTeams];
      for (let i = randomizedNonByes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [randomizedNonByes[i], randomizedNonByes[j]] = [randomizedNonByes[j], randomizedNonByes[i]];
      }

      const numMatchesR1 = P / 2;
      const numRealMatches = N - P / 2;

      for (let m = 1; m <= numMatchesR1; m++) {
        const matchId = createdMatchesMap[`${roundsCount}_${m}`];
        if (m <= numRealMatches) {
          // Normal Match: 2 real teams
          const idx = (m - 1) * 2;
          await pb.collection('matches').update(matchId, {
            team1: randomizedNonByes[idx].id,
            team2: randomizedNonByes[idx + 1].id
          }, { requestKey: null });
        } else {
          // Bye Match: 1 real team, 1 BYE
          const byeIdx = m - 1 - numRealMatches;
          const byeTeamId = byeTeams[byeIdx].id;
          await pb.collection('matches').update(matchId, {
            team1: byeTeamId,
            team2: null,
            status: 'Completed',
            winner: byeTeamId
          }, { requestKey: null });

          // Promote the team immediately to Round 2
          const targetRound = roundsCount - 1;
          if (targetRound >= 1) {
            const targetMatchIndex = Math.ceil(m / 2);
            const slot = m % 2 !== 0 ? 'team1' : 'team2';
            const targetMatchId = createdMatchesMap[`${targetRound}_${targetMatchIndex}`];
            await pb.collection('matches').update(targetMatchId, {
              [slot]: byeTeamId
            }, { requestKey: null });
          }
        }
      }

      setSuccessMsg(`Knockout bracket matches initialized successfully for ${N} teams (${P - N} Byes)!`);
      refreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error initializing bracket matches.');
    } finally {
      setIsInitializingBracket(false);
    }
  };

  const handleResetBracket = () => {
    triggerConfirm(
      'Reset Tournament Bracket?',
      'This will completely clear the bracket, delete all matches, innings, and live scorecards. You will need to regenerate the bracket from scratch. This action cannot be undone.',
      async () => {
        setIsInitializingBracket(true);
        setErrorMsg('');
        setSuccessMsg('');
        try {
          const existingMatches = await pb.collection('matches').getFullList({ fields: 'id', requestKey: null });
          for (const m of existingMatches) {
            const existingInnings = await pb.collection('innings').getFullList({
              filter: `match = "${m.id}"`,
              fields: 'id',
              requestKey: null
            });
            for (const inn of existingInnings) {
              const existingDeliveries = await pb.collection('deliveries').getFullList({
                filter: `inning = "${inn.id}"`,
                fields: 'id',
                requestKey: null
              });
              for (const del of existingDeliveries) {
                await pb.collection('deliveries').delete(del.id, { requestKey: null });
              }
              await pb.collection('innings').delete(inn.id, { requestKey: null });
            }
            await pb.collection('matches').delete(m.id, { requestKey: null });
          }
          setSuccessMsg('All bracket matches, innings, and scoring data reset successfully.');
          refreshData();
        } catch (err: any) {
          setErrorMsg(err.message || 'Error resetting tournament bracket.');
        } finally {
          setIsInitializingBracket(false);
        }
      },
      {
        confirmText: 'Yes, Reset Everything',
        cancelText: 'Cancel',
        isDanger: true
      }
    );
  };

  const handleCleanAllTeamsAndPlayers = () => {
    triggerConfirm(
      'Clean All Teams & Players?',
      'This will completely delete all teams, players, matches, innings, deliveries, fantasy teams, and votes from the database. This action cannot be undone.',
      async () => {
        setIsSavingConfig(true);
        setErrorMsg('');
        setSuccessMsg('');
        try {
          // 1. Delete all deliveries
          const allDeliveriesList = await pb.collection('deliveries').getFullList({ fields: 'id', requestKey: null });
          for (const d of allDeliveriesList) {
            await pb.collection('deliveries').delete(d.id, { requestKey: null });
          }
          // 2. Delete all innings
          const allInningsList = await pb.collection('innings').getFullList({ fields: 'id', requestKey: null });
          for (const i of allInningsList) {
            await pb.collection('innings').delete(i.id, { requestKey: null });
          }
          // 3. Delete all matches
          const allMatchesList = await pb.collection('matches').getFullList({ fields: 'id', requestKey: null });
          for (const m of allMatchesList) {
            await pb.collection('matches').delete(m.id, { requestKey: null });
          }
          // 4. Delete all fantasy teams
          const allFantasyList = await pb.collection('fantasy_teams').getFullList({ fields: 'id', requestKey: null });
          for (const f of allFantasyList) {
            await pb.collection('fantasy_teams').delete(f.id, { requestKey: null });
          }
          // 5. Delete all match votes
          const allVotesList = await pb.collection('match_votes').getFullList({ fields: 'id', requestKey: null });
          for (const v of allVotesList) {
            await pb.collection('match_votes').delete(v.id, { requestKey: null });
          }
          // 6. Delete all players
          const allPlayers = await pb.collection('players').getFullList({ fields: 'id', requestKey: null });
          for (const p of allPlayers) {
            await pb.collection('players').delete(p.id, { requestKey: null });
          }
          // 7. Delete all teams
          const allTeams = await pb.collection('teams').getFullList({ fields: 'id', requestKey: null });
          for (const t of allTeams) {
            await pb.collection('teams').delete(t.id, { requestKey: null });
          }
          if (tournamentConfig) {
            await pb.collection('tournament_config').update(tournamentConfig.id, {
              man_of_the_series: null,
              mos_performance: ''
            });
          }
          setSuccessMsg('All teams, players, matches, scoring data, fantasy teams, and votes deleted successfully.');
          refreshData();
        } catch (err: any) {
          setErrorMsg(err.message || 'Error cleaning teams and players.');
        } finally {
          setIsSavingConfig(false);
        }
      },
      {
        confirmText: 'Yes, Delete All Teams & Players',
        cancelText: 'Cancel',
        isDanger: true
      }
    );
  };

  const handleExportReport = async () => {
    setIsExporting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const allInnings = await pb.collection('innings').getFullList<Inning>({ sort: '+created', requestKey: null });
      const allDeliveries = await pb.collection('deliveries').getFullList<Delivery>({ sort: '+created', requestKey: null });

      const finalMatch = matches.find(m => m.stage.toLowerCase() === 'final' && m.status === 'Completed');
      let championTeam = 'Not Decided';
      if (finalMatch && finalMatch.winner) {
        const cTeam = teams.find(t => t.id === finalMatch.winner);
        if (cTeam) {
          championTeam = cTeam.name;
        }
      }

      const mosPlayer = players.find(p => p.id === mosPlayerId);
      const mosPlayerName = mosPlayer ? mosPlayer.name : 'Not Decided';

      const summaryData = [
        { Metric: 'Tournament Name', Value: 'TRISCHEL SPORTS ENCOUNTER - 2026' },
        { Metric: 'Tournament Subtitle', Value: 'CRICKET CHAMPIONSHIP' },
        { Metric: 'Champion Team', Value: championTeam },
        { Metric: 'Man of the Series', Value: mosPlayerName },
        { Metric: 'MOS Performance Details', Value: mosPerformance || 'N/A' },
        { Metric: 'Total Teams', Value: teams.length },
        { Metric: 'Total Players', Value: players.length },
        { Metric: 'Total Matches', Value: matches.length },
        { Metric: 'Completed Matches', Value: matches.filter(m => m.status === 'Completed').length },
        { Metric: 'Live Matches', Value: matches.filter(m => m.status === 'Live').length },
        { Metric: 'Upcoming Matches', Value: matches.filter(m => m.status === 'Upcoming').length },
      ];

      const teamsData = teams.map(t => {
        const squad = players.filter(p => p.team === t.id);
        const captain = squad.find(p => p.id === t.captain);
        return {
          'Team Name': t.name,
          'Short Name': t.short_name,
          'Captain': captain ? captain.name : '-',
          'Squad Size': squad.length
        };
      });

      const playersData = players.map(p => {
        const team = teams.find(t => t.id === p.team);
        return {
          'Player Name': p.name,
          'Player Number': p.epf_number || '-',
          'Role': p.role,
          'Team Name': team ? team.name : 'Unknown'
        };
      });

      const matchesData = matches.map(m => {
        const t1 = teams.find(t => t.id === m.team1);
        const t2 = teams.find(t => t.id === m.team2);
        const winner = teams.find(t => t.id === m.winner);
        const mInnings = allInnings.filter(inn => inn.match === m.id);

        const getInningScore = (inn?: Inning) => {
          if (!inn) return '-';
          const batTeam = teams.find(t => t.id === inn.batting_team);
          return batTeam
            ? `${batTeam.short_name}: ${inn.total_runs}/${inn.total_wickets} (${inn.total_overs} ov)`
            : `${inn.total_runs}/${inn.total_wickets} (${inn.total_overs} ov)`;
        };

        const getSuperOverDetails = () => {
          if (mInnings.length <= 2) return '-';
          const superInnings = mInnings.slice(2);
          const details: string[] = [];
          for (let i = 0; i < superInnings.length; i += 2) {
            const inn1 = superInnings[i];
            const inn2 = superInnings[i + 1];
            const t1Name = teams.find(t => t.id === inn1.batting_team)?.short_name || 'Unknown';
            const score1 = `${t1Name}: ${inn1.total_runs}/${inn1.total_wickets} (${inn1.total_overs} ov)`;
            
            let score2 = 'DNB';
            if (inn2) {
              const t2Name = teams.find(t => t.id === inn2.batting_team)?.short_name || 'Unknown';
              score2 = `${t2Name}: ${inn2.total_runs}/${inn2.total_wickets} (${inn2.total_overs} ov)`;
            }
            details.push(`SO ${Math.floor(i / 2) + 1} (${score1} vs ${score2})`);
          }
          return details.join(' | ');
        };

        const matchDate = m.match_time ? new Date(m.match_time).toLocaleString() : '-';

        return {
          'Stage': parseStage ? parseStage(m.stage).name : m.stage,
          'Match Date/Time': matchDate,
          'Team 1': t1 ? t1.name : 'TBD',
          'Team 2': t2 ? t2.name : 'TBD',
          'Status': m.status,
          'Innings 1 Score': getInningScore(mInnings[0]),
          'Innings 2 Score': getInningScore(mInnings[1]),
          'Super Over Score(s)': getSuperOverDetails(),
          'Winner': winner ? winner.name : (m.status === 'Completed' ? 'Tie/No Result' : '-')
        };
      });

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
        fielding: {
          catches: number;
          runouts: number;
          stumpings: number;
          total: number;
        };
      }> = {};

      players.forEach(p => {
        statsMap[p.id] = {
          batting: { innings: new Set(), runs: 0, balls: 0, fours: 0, sixes: 0, outs: 0 },
          bowling: { innings: new Set(), balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0 },
          fielding: { catches: 0, runouts: 0, stumpings: 0, total: 0 }
        };
      });

      allDeliveries.forEach(d => {
        const runs = d.runs || 0;
        const isWide = d.extra_type === 'Wide';
        const isNoBall = d.extra_type === 'No Ball';
        const isLegal = !isWide && !isNoBall;

        if (d.striker && statsMap[d.striker]) {
          const stats = statsMap[d.striker].batting;
          stats.innings.add(d.inning);
          if (!isWide) {
            const isByeOrLegBye = d.extra_type === 'Bye' || d.extra_type === 'Leg Bye';
            const runOffBat = isByeOrLegBye ? 0 : (isNoBall ? Math.max(0, runs - 1) : runs);
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

        if (d.is_wicket && d.fielder && statsMap[d.fielder]) {
          const f = statsMap[d.fielder].fielding;
          if (d.dismissal_type === 'Catch') {
            f.catches += 1;
            f.total += 1;
          } else if (d.dismissal_type === 'Run Out') {
            f.runouts += 1;
            f.total += 1;
          } else if (d.dismissal_type === 'Stumped') {
            f.stumpings += 1;
            f.total += 1;
          }
        }
      });

      const topBatsmenData = players
        .map(p => {
          const bat = statsMap[p.id].batting;
          const team = teams.find(t => t.id === p.team);
          const avgVal = bat.outs === 0 ? (bat.runs > 0 ? `${bat.runs}*` : '0.00') : (bat.runs / bat.outs).toFixed(2);
          const srVal = bat.balls === 0 ? '0.00' : ((bat.runs / bat.balls) * 100).toFixed(2);
          return {
            name: p.name,
            epf: p.epf_number || '-',
            team: team ? team.name : 'Unknown',
            innings: bat.innings.size,
            runs: bat.runs,
            balls: bat.balls,
            avg: avgVal,
            sr: srVal,
            fours: bat.fours,
            sixes: bat.sixes
          };
        })
        .filter(b => b.innings > 0 || b.runs > 0 || b.balls > 0)
        .sort((a, b) => b.runs - a.runs)
        .map((row, idx) => ({
          'Rank': idx + 1,
          'Player Name': row.name,
          'Player Number': row.epf,
          'Team': row.team,
          'Innings': row.innings,
          'Runs': row.runs,
          'Balls': row.balls,
          'Average': row.avg,
          'Strike Rate': row.sr,
          '4s': row.fours,
          '6s': row.sixes
        }));

      const topBowlersData = players
        .map(p => {
          const bowl = statsMap[p.id].bowling;
          const team = teams.find(t => t.id === p.team);
          const avgVal = bowl.wickets === 0 ? 'N/A' : (bowl.runs / bowl.wickets).toFixed(2);
          const econVal = bowl.balls === 0 ? '0.00' : (bowl.runs / (bowl.balls / 6)).toFixed(2);
          const oversStr = `${Math.floor(bowl.balls / 6)}.${bowl.balls % 6}`;
          return {
            name: p.name,
            epf: p.epf_number || '-',
            team: team ? team.name : 'Unknown',
            innings: bowl.innings.size,
            overs: oversStr,
            balls: bowl.balls,
            wickets: bowl.wickets,
            runs: bowl.runs,
            econ: econVal,
            avg: avgVal,
            wides: bowl.wides,
            noBalls: bowl.noBalls
          };
        })
        .filter(b => b.innings > 0 || b.balls > 0 || b.wickets > 0)
        .sort((a, b) => {
          if (b.wickets !== a.wickets) {
            return b.wickets - a.wickets;
          }
          return a.runs - b.runs;
        })
        .map((row, idx) => ({
          'Rank': idx + 1,
          'Player Name': row.name,
          'Player Number': row.epf,
          'Team': row.team,
          'Innings': row.innings,
          'Overs': row.overs,
          'Wickets': row.wickets,
          'Runs Conceded': row.runs,
          'Economy': row.econ,
          'Average': row.avg,
          'Wides': row.wides,
          'No Balls': row.noBalls
        }));

      const topFieldersData = players
        .map(p => {
          const field = statsMap[p.id].fielding;
          const team = teams.find(t => t.id === p.team);
          return {
            name: p.name,
            epf: p.epf_number || '-',
            team: team ? team.name : 'Unknown',
            catches: field.catches,
            runouts: field.runouts,
            stumpings: field.stumpings,
            total: field.total
          };
        })
        .filter(f => f.total > 0)
        .sort((a, b) => b.total - a.total)
        .map((row, idx) => ({
          'Rank': idx + 1,
          'Player Name': row.name,
          'Player Number': row.epf,
          'Team': row.team,
          'Catches': row.catches,
          'Run Outs': row.runouts,
          'Stumpings': row.stumpings,
          'Total Dismissals': row.total
        }));

      const wb = XLSX.utils.book_new();

      const summaryWS = XLSX.utils.json_to_sheet(summaryData);
      const teamsWS = XLSX.utils.json_to_sheet(teamsData);
      const playersWS = XLSX.utils.json_to_sheet(playersData);
      const matchesWS = XLSX.utils.json_to_sheet(matchesData);
      const batsmenWS = XLSX.utils.json_to_sheet(topBatsmenData);
      const bowlersWS = XLSX.utils.json_to_sheet(topBowlersData);
      const fieldersWS = XLSX.utils.json_to_sheet(topFieldersData);

      const fitColumns = (ws: XLSX.WorkSheet, data: any[]) => {
        if (!data || data.length === 0) return;
        const keys = Object.keys(data[0]);
        ws['!cols'] = keys.map(key => {
          let maxLen = key.length;
          data.forEach(row => {
            const val = row[key];
            if (val !== undefined && val !== null) {
              maxLen = Math.max(maxLen, val.toString().length);
            }
          });
          return { wch: maxLen + 3 };
        });
      };

      fitColumns(summaryWS, summaryData);
      fitColumns(teamsWS, teamsData);
      fitColumns(playersWS, playersData);
      fitColumns(matchesWS, matchesData);
      fitColumns(batsmenWS, topBatsmenData);
      fitColumns(bowlersWS, topBowlersData);
      fitColumns(fieldersWS, topFieldersData);

      XLSX.utils.book_append_sheet(wb, summaryWS, 'Summary');
      XLSX.utils.book_append_sheet(wb, teamsWS, 'Teams');
      XLSX.utils.book_append_sheet(wb, playersWS, 'Players');
      XLSX.utils.book_append_sheet(wb, matchesWS, 'Matches');
      XLSX.utils.book_append_sheet(wb, batsmenWS, 'Top Batsmen');
      XLSX.utils.book_append_sheet(wb, bowlersWS, 'Top Bowlers');
      XLSX.utils.book_append_sheet(wb, fieldersWS, 'Top Fielders');

      XLSX.writeFile(wb, 'Tournament_Report_2026.xlsx');
      setSuccessMsg('Tournament report exported successfully!');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to export tournament report.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadMatchReport = async (matchId: string) => {
    try {
      const match = matches.find(m => m.id === matchId);
      if (!match) throw new Error('Match not found');

      const t1 = teams.find(t => t.id === match.team1);
      const t2 = teams.find(t => t.id === match.team2);
      const winnerTeam = teams.find(t => t.id === match.winner);

      // Fetch innings
      const matchInnings = await pb.collection('innings').getFullList<Inning>({
        filter: `match = "${matchId}"`,
        sort: 'created',
      });

      if (matchInnings.length === 0) {
        alert('No scorecard data recorded yet for this match.');
        return;
      }

      // Fetch deliveries
      const inningIds = matchInnings.map(i => i.id);
      const filterStr = inningIds.map(id => `inning = "${id}"`).join(' || ');
      const deliveriesList = await pb.collection('deliveries').getFullList<Delivery>({
        filter: filterStr,
        sort: 'created',
        expand: 'striker,bawler,out_player,fielder'
      });

      // Simulation function (identical to LiveScorecard getInningState)
      const computeInningState = (inning: Inning) => {
        const inningDeliveries = deliveriesList.filter(d => d.inning === inning.id);
        const isSpecialExtras = match.special_extras || false;

        let totalRuns = 0;
        let totalWickets = 0;
        let totalBalls = 0;

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

          if (d.striker) {
            if (!isWide && d.dismissal_type !== 'Retired Out') {
              batsmanRuns[d.striker] = (batsmanRuns[d.striker] || 0) + runOffBat;
              batsmanBalls[d.striker] = (batsmanBalls[d.striker] || 0) + 1;

              if (runOffBat === 4) {
                batsmanFours[d.striker] = (batsmanFours[d.striker] || 0) + 1;
              } else if (runOffBat === 6) {
                batsmanSixes[d.striker] = (batsmanSixes[d.striker] || 0) + 1;
              }
            }

            if ((d.is_wicket || d.dismissal_type === 'Retired Out') && d.out_player) {
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

          if (d.bawler) {
            if (isLegal && d.dismissal_type !== 'Retired Out') {
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
          }
        });

        return {
          totalRuns,
          totalWickets,
          totalBalls,
          oversStr: `${Math.floor(totalBalls / 6)}.${totalBalls % 6}`,
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
          totalExtras: extrasWides + extrasNoBalls + extrasByes + extrasLegByes
        };
      };

      const inningsData = matchInnings.map(inn => {
        const innTeam = teams.find(t => t.id === inn.batting_team);
        const oppTeam = teams.find(t => t.id === inn.bawling_team);
        const state = computeInningState(inn);
        return {
          inning: inn,
          team: innTeam,
          opponent: oppTeam,
          state
        };
      });

      // Generate HTML report structure
      const reportHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Match Report - ${t1?.name || 'T1'} vs ${t2?.name || 'T2'}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              color: #1e293b;
              margin: 40px auto;
              max-width: 800px;
              line-height: 1.5;
            }
            .header {
              border-bottom: 3px double #cbd5e1;
              padding-bottom: 20px;
              margin-bottom: 30px;
              text-align: center;
            }
            .header h1 {
              font-size: 24px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin: 0 0 5px 0;
              color: #0f172a;
            }
            .header h2 {
              font-size: 16px;
              font-weight: 600;
              color: #475569;
              margin: 0 0 15px 0;
            }
            .match-meta {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              color: #64748b;
              font-weight: 500;
            }
            .match-result-banner {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 12px 20px;
              text-align: center;
              font-weight: 700;
              font-size: 14px;
              color: #0f172a;
              margin-bottom: 30px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .inning-section {
              margin-bottom: 40px;
              page-break-inside: avoid;
            }
            .inning-header {
              display: flex;
              justify-content: space-between;
              align-items: baseline;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 6px;
              margin-bottom: 15px;
            }
            .inning-header h3 {
              font-size: 16px;
              font-weight: 800;
              margin: 0;
              color: #0f172a;
            }
            .inning-header .score {
              font-size: 18px;
              font-weight: 800;
              color: #0f172a;
            }
            .table-title {
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #475569;
              margin: 15px 0 8px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              font-size: 12px;
            }
            th {
              background-color: #f1f5f9;
              color: #475569;
              font-weight: 700;
              text-align: left;
              padding: 6px 8px;
              border-bottom: 1px solid #cbd5e1;
            }
            td {
              padding: 6px 8px;
              border-bottom: 1px solid #e2e8f0;
            }
            .text-right {
              text-align: right;
            }
            .font-bold {
              font-weight: 700;
            }
            .dismissal-text {
              color: #64748b;
              font-style: italic;
              font-size: 11px;
            }
            .extras-row {
              background-color: #f8fafc;
              font-size: 11px;
            }
            .extras-row td {
              border-bottom: 1px solid #cbd5e1;
            }
            .footer {
              margin-top: 50px;
              border-top: 1px solid #cbd5e1;
              padding-top: 10px;
              text-align: center;
              font-size: 10px;
              color: #94a3b8;
            }
            @media print {
              body {
                margin: 20px;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Cricket Tournament 2026</h1>
            <h2>OFFICIAL MATCH SCORECARD</h2>
            <div class="match-meta">
              <span>STAGE: ${match.stage}</span>
              <span>DATE/TIME: ${match.match_time ? new Date(match.match_time).toLocaleString() : 'N/A'}</span>
              <span>SPECIAL EXTRAS: ${match.special_extras ? 'YES' : 'NO'}</span>
            </div>
          </div>

          <div class="match-result-banner">
            ${
              match.status === 'Completed'
                ? (winnerTeam ? `RESULT: ${winnerTeam.name} WON THE MATCH` : 'RESULT: MATCH DRAWN / TIED')
                : 'STATUS: MATCH IN PROGRESS'
            }
          </div>

          ${inningsData.map(({ team, opponent, state }, idx) => {
            const formatBattingSR = (runs: number, balls: number) => {
              if (balls === 0) return '0.00';
              return ((runs / balls) * 100).toFixed(2);
            };

            const formatBowlerEcon = (runs: number, balls: number) => {
              if (balls === 0) return '0.00';
              const overs = balls / 6;
              return (runs / overs).toFixed(2);
            };

            return `
              <div class="inning-section">
                <div class="inning-header">
                  <h3>${idx >= 2 ? `Super Over ${Math.floor((idx - 2) / 2) + 1} - Inning ${idx % 2 === 0 ? 1 : 2}` : `Inning ${idx + 1}`}: ${team?.name || 'Unknown'}</h3>
                  <div class="score">${state.totalRuns}/${state.totalWickets} <span style="font-size: 13px; font-weight: 500; color: #64748b;">(${state.oversStr} Overs)</span></div>
                </div>

                <div class="table-title">Batting Performance</div>
                <table>
                  <thead>
                    <tr>
                      <th style="width: 25%;">Batter</th>
                      <th style="width: 40%;">Dismissal</th>
                      <th class="text-right" style="width: 7%;">R</th>
                      <th class="text-right" style="width: 7%;">B</th>
                      <th class="text-right" style="width: 7%;">4s</th>
                      <th class="text-right" style="width: 7%;">6s</th>
                      <th class="text-right" style="width: 7%;">SR</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${Object.entries(state.batsmanRuns).map(([bId, runs]) => {
                      const p = players.find(player => player.id === bId);
                      let pName = p ? p.name : 'Unknown';
                      if (tournamentConfig?.show_epf_number && p?.epf_number) {
                        pName += ` (${p.epf_number})`;
                      }
                      if (team?.captain === bId) {
                        pName += ' (C)';
                      }
                      const balls = state.batsmanBalls[bId] || 0;
                      const fours = state.batsmanFours[bId] || 0;
                      const sixes = state.batsmanSixes[bId] || 0;
                      const dis = state.batsmanDismissal[bId] || 'not out';
                      return `
                        <tr>
                          <td class="font-bold">${pName}</td>
                          <td class="dismissal-text">${dis}</td>
                          <td class="text-right font-bold">${runs}</td>
                          <td class="text-right">${balls}</td>
                          <td class="text-right">${fours}</td>
                          <td class="text-right">${sixes}</td>
                          <td class="text-right">${formatBattingSR(runs, balls)}</td>
                        </tr>
                      `;
                    }).join('')}
                    <tr class="extras-row">
                      <td class="font-bold">Extras</td>
                      <td colspan="6" class="font-bold">
                        ${state.totalExtras} <span style="font-weight: normal; color: #64748b;">(wd ${state.extrasWides}, nb ${state.extrasNoBalls}, b ${state.extrasByes}, lb ${state.extrasLegByes})</span>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div class="table-title">Bowling Performance</div>
                <table>
                  <thead>
                    <tr>
                      <th style="width: 35%;">Bowler</th>
                      <th class="text-right" style="width: 10%;">Overs</th>
                      <th class="text-right" style="width: 10%;">Runs</th>
                      <th class="text-right" style="width: 10%;">Wickets</th>
                      <th class="text-right" style="width: 10%;">WD</th>
                      <th class="text-right" style="width: 10%;">NB</th>
                      <th class="text-right" style="width: 15%;">Econ</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${Object.entries(state.bowlerBalls).map(([bowlerId, balls]) => {
                      const p = players.find(player => player.id === bowlerId);
                      let pName = p ? p.name : 'Unknown';
                      if (tournamentConfig?.show_epf_number && p?.epf_number) {
                        pName += ` (${p.epf_number})`;
                      }
                      if (opponent?.captain === bowlerId) {
                        pName += ' (C)';
                      }
                      const runs = state.bowlerRuns[bowlerId] || 0;
                      const wickets = state.bowlerWickets[bowlerId] || 0;
                      const wides = state.bowlerWides[bowlerId] || 0;
                      const noBalls = state.bowlerNoBalls[bowlerId] || 0;
                      const oversStr = `${Math.floor(balls / 6)}.${balls % 6}`;
                      return `
                        <tr>
                          <td class="font-bold">${pName}</td>
                          <td class="text-right font-bold">${oversStr}</td>
                          <td class="text-right">${runs}</td>
                          <td class="text-right font-bold">${wickets}</td>
                          <td class="text-right">${wides}</td>
                          <td class="text-right">${noBalls}</td>
                          <td class="text-right">${formatBowlerEcon(runs, balls)}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `;
          }).join('')}

          <div class="footer">
            Report generated on ${new Date().toLocaleString()} &bull; Cricket Tournament Admin Panel
          </div>
        </body>
        </html>
      `;

      // Open new window and print
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(reportHtml);
        printWindow.document.close();
        printWindow.focus();
        // Give fonts/styles a moment to load, then print and close
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
      } else {
        alert('Popup blocker prevented match report window from opening.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to generate match report: ' + err.message);
    }
  };

  // Fallback to all players of the team if squad lists are empty (resumed match support)
  const t1Players = selectedMatch ? players.filter(p => p.team === selectedMatch.team1) : [];
  const t2Players = selectedMatch ? players.filter(p => p.team === selectedMatch.team2) : [];

  const activeBattingSquad = selectedMatch ? (
    activeInning 
      ? (activeInning.batting_team === selectedMatch.team1 
          ? (team1Squad.length > 0 ? team1Squad : t1Players.map(p => p.id))
          : (team2Squad.length > 0 ? team2Squad : t2Players.map(p => p.id)))
      : (battingFirst === selectedMatch.team1 
          ? (team1Squad.length > 0 ? team1Squad : t1Players.map(p => p.id))
          : (team2Squad.length > 0 ? team2Squad : t2Players.map(p => p.id)))
  ) : [];

  const activeBowlingSquad = selectedMatch ? (
    activeInning
      ? (activeInning.bawling_team === selectedMatch.team1 
          ? (team1Squad.length > 0 ? team1Squad : t1Players.map(p => p.id))
          : (team2Squad.length > 0 ? team2Squad : t2Players.map(p => p.id)))
      : (battingFirst === selectedMatch.team1 
          ? (team2Squad.length > 0 ? team2Squad : t2Players.map(p => p.id))
          : (team1Squad.length > 0 ? team1Squad : t1Players.map(p => p.id)))
  ) : [];

  // Active inning stats calculations
  const inningDeliveries = activeInning ? deliveries.filter(d => d.inning === activeInning.id) : [];
  const legalBallsCount = inningDeliveries.filter(d => {
    if (d.dismissal_type === 'Retired Out') return false;
    if (selectedMatch?.special_extras) {
      return d.ball_number > 0;
    }
    return d.extra_type !== 'Wide' && d.extra_type !== 'No Ball';
  }).length;
  const totalRuns = inningDeliveries.reduce((sum, d) => sum + (d.runs || 0), 0);
  const totalWickets = inningDeliveries.filter(d => d.is_wicket).length;

  const maxWickets = innings.length > 2 ? 2 : 10;

  const isTargetChased = (() => {
    if (selectedMatch && innings.length >= 2 && innings.length % 2 === 0 && activeInning && activeInning.id === innings[innings.length - 1].id) {
      const prevInningIdx = innings.length - 2;
      const prevInningDeliveries = deliveries.filter(d => d.inning === innings[prevInningIdx].id);
      const prevInningRuns = prevInningDeliveries.reduce((sum, d) => sum + (d.runs || 0), 0);
      return totalRuns > prevInningRuns;
    }
    return false;
  })();

  const isOversLimitMet = legalBallsCount >= oversLimit * 6;
  const isAllOut = totalWickets >= maxWickets;

  const isPlayerSelectionValid = Boolean(
    activeInning &&
    strikerId && 
    nonStrikerId && 
    bowlerId && 
    strikerId !== nonStrikerId &&
    players.find(p => p.id === strikerId)?.team === activeInning.batting_team &&
    players.find(p => p.id === nonStrikerId)?.team === activeInning.batting_team &&
    players.find(p => p.id === bowlerId)?.team === activeInning.bawling_team
  );

  const isScoringLocked = isTargetChased || isOversLimitMet || isAllOut || !isPlayerSelectionValid;
  
  // Bowler delivery count mapping
  const getBowlerBalls = (playerId: string) => {
    return inningDeliveries.filter(d => {
      if (d.bawler !== playerId) return false;
      if (d.dismissal_type === 'Retired Out') return false;
      if (selectedMatch?.special_extras) {
        return d.ball_number > 0;
      }
      return d.extra_type !== 'Wide' && d.extra_type !== 'No Ball';
    }).length;
  };

  const handleCreateSuperOverInning = async (battingTeamId: string, bowlingTeamId: string) => {
    if (!soSelectMatch) return;
    try {
      await pb.collection('innings').create<Inning>({
        match: soSelectMatch.id,
        batting_team: battingTeamId,
        bawling_team: bowlingTeamId,
        total_runs: 0,
        total_wickets: 0,
        total_overs: 0
      });

      setStrikerId('');
      setNonStrikerId('');
      setBowlerId('');
      setSuccessMsg(`Super Over ${soRoundNumToCreate} started!`);
      setShowSOBattingFirstSelectModal(false);
      setSoSelectMatch(null);
      fetchMatchInnings(soSelectMatch.id, true);
    } catch (err: any) {
      setScorerErrorMsg(err.message || 'Error starting Super Over.');
      setShowScorerErrorModal(true);
    }
  };

  const handleMatchSelect = (match: Match) => {
    setSelectedMatch(match);
    setErrorMsg('');
    setSuccessMsg('');
    
    // Load from local storage if exists
    const saved = localStorage.getItem(`squad_${match.id}`);
    if (saved) {
      try {
        const { t1Squad, t2Squad, batFirst, strikerId: savedStriker, nonStrikerId: savedNonStriker, bowlerId: savedBowler } = JSON.parse(saved);
        setTeam1Squad(t1Squad || []);
        setTeam2Squad(t2Squad || []);
        setBattingFirst(batFirst || '');
        setStrikerId(savedStriker || '');
        setNonStrikerId(savedNonStriker || '');
        setBowlerId(savedBowler || '');
      } catch (err) {
        console.error('Error loading saved squad:', err);
        setTeam1Squad([]);
        setTeam2Squad([]);
        setBattingFirst('');
        setStrikerId('');
        setNonStrikerId('');
        setBowlerId('');
      }
    } else {
      setTeam1Squad([]);
      setTeam2Squad([]);
      setBattingFirst('');
      setStrikerId('');
      setNonStrikerId('');
      setBowlerId('');
    }

    if (match.overs_limit) {
      setOversLimit(match.overs_limit);
    } else {
      setOversLimit(5);
    }
  };

  // Add Team Action
  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const formData = new FormData();
      formData.append('name', newTeamName);
      formData.append('short_name', newTeamShortName);
      if (newTeamLogo) {
        formData.append('logo', newTeamLogo);
      }

      await pb.collection('teams').create(formData);
      setSuccessMsg(`Team "${newTeamName}" created successfully!`);
      setNewTeamName('');
      setNewTeamShortName('');
      setNewTeamLogo(null);
      const fileInput = document.getElementById('team-logo-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      refreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating team.');
    }
  };

  // Add Player Action
  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (!newPlayerTeamId) {
        setErrorMsg('Please select a team.');
        return;
      }

      // Check Squad Size limit (Max 15 players per team)
      const existingCount = players.filter(p => p.team === newPlayerTeamId).length;
      if (existingCount >= 15) {
        setErrorMsg('This team already has the maximum of 15 players registered.');
        return;
      }

      const formData = new FormData();
      formData.append('name', newPlayerName);
      formData.append('role', newPlayerRole);
      formData.append('team', newPlayerTeamId);
      formData.append('epf_number', newPlayerEpf);
      if (newPlayerPhoto) {
        formData.append('photo', newPlayerPhoto);
      }

      await pb.collection('players').create(formData);
      setSuccessMsg(`Player "${newPlayerName}" registered successfully!`);
      setNewPlayerName('');
      setNewPlayerEpf('');
      setNewPlayerPhoto(null);
      const fileInput = document.getElementById('player-photo-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      refreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating player.');
    }
  };

  // Edit Team Action
  const handleEditTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const formData = new FormData();
      formData.append('name', editTeamName);
      formData.append('short_name', editTeamShortName);
      formData.append('captain', editTeamCaptainId || '');
      if (editTeamLogo) {
        formData.append('logo', editTeamLogo);
      }

      await pb.collection('teams').update(editingTeam.id, formData);
      setSuccessMsg(`Team "${editTeamName}" updated successfully!`);
      setEditingTeam(null);
      setEditTeamLogo(null);
      setEditTeamCaptainId('');
      refreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating team.');
    }
  };

  // Edit Player Action
  const handleEditPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      // Validate max squad limit if team changed
      if (editPlayerTeamId !== editingPlayer.team) {
        const count = players.filter(p => p.team === editPlayerTeamId).length;
        if (count >= 15) {
          setErrorMsg('The selected team already has the maximum of 15 players registered.');
          return;
        }
      }

      const formData = new FormData();
      formData.append('name', editPlayerName);
      formData.append('role', editPlayerRole);
      formData.append('team', editPlayerTeamId);
      formData.append('epf_number', editPlayerEpf || '');
      if (editPlayerPhoto) {
        formData.append('photo', editPlayerPhoto);
      }

      await pb.collection('players').update(editingPlayer.id, formData);
      setSuccessMsg(`Player "${editPlayerName}" updated successfully!`);
      setEditingPlayer(null);
      setEditPlayerPhoto(null);
      setEditPlayerEpf('');
      refreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating player.');
    }
  };

  // Delete Team Action
  const handleDeleteTeam = (teamId: string) => {
    const team = getTeam(teamId);
    if (!team) return;
    triggerConfirm(
      "Delete Team",
      `Are you sure you want to delete "${team.name}"? This will delete associated players, matches, innings, deliveries, fantasy squads, and votes.`,
      async () => {
        setErrorMsg('');
        setSuccessMsg('');
        try {
          // 1. Delete all votes referencing this team
          const teamVotes = await pb.collection('match_votes').getFullList({
            filter: `team = "${teamId}"`,
            fields: 'id',
            requestKey: null
          });
          for (const v of teamVotes) {
            await pb.collection('match_votes').delete(v.id, { requestKey: null });
          }

          // 2. Delete all matches (and their deliveries/innings/votes) referencing this team
          const associatedMatches = matches.filter(m => m.team1 === teamId || m.team2 === teamId);
          for (const m of associatedMatches) {
            const matchVotes = await pb.collection('match_votes').getFullList({
              filter: `match = "${m.id}"`,
              fields: 'id',
              requestKey: null
            });
            for (const v of matchVotes) {
              await pb.collection('match_votes').delete(v.id, { requestKey: null });
            }

            const matchInnings = innings.filter((i: Inning) => i.match === m.id);
            for (const inn of matchInnings) {
              const existingDeliveries = await pb.collection('deliveries').getFullList({
                filter: `inning = "${inn.id}"`,
                fields: 'id',
                requestKey: null
              });
              for (const del of existingDeliveries) {
                await pb.collection('deliveries').delete(del.id, { requestKey: null });
              }
              await pb.collection('innings').delete(inn.id, { requestKey: null });
            }
            await pb.collection('matches').delete(m.id, { requestKey: null });
          }

          // 3. For all players of this team: clean them from fantasy teams, delete deliveries, then delete player
          const teamPlayersList = players.filter(p => p.team === teamId);
          const allFantasyTeams = await pb.collection('fantasy_teams').getFullList({ requestKey: null });
          
          for (const p of teamPlayersList) {
            const associatedFantasyTeams = allFantasyTeams.filter((ft: any) => (ft.players || []).includes(p.id));
            for (const ft of associatedFantasyTeams) {
              const updatedPlayers = (ft.players || []).filter((id: string) => id !== p.id);
              await pb.collection('fantasy_teams').update(ft.id, { players: updatedPlayers }, { requestKey: null });
            }

            const pDels = await pb.collection('deliveries').getFullList({
              filter: `striker = "${p.id}" || bawler = "${p.id}" || out_player = "${p.id}" || fielder = "${p.id}"`,
              fields: 'id',
              requestKey: null
            });
            for (const d of pDels) {
              await pb.collection('deliveries').delete(d.id, { requestKey: null });
            }

            await pb.collection('players').delete(p.id, { requestKey: null });
          }

          // 4. Delete team
          await pb.collection('teams').delete(teamId, { requestKey: null });

          setSuccessMsg(`Team "${team.name}" and its associated records were deleted successfully.`);
          refreshData();
        } catch (err: any) {
          setErrorMsg(err.message || 'Error deleting team.');
        }
      },
      { confirmText: 'Delete Team', isDanger: true }
    );
  };

  // Delete Player Action
  const handleDeletePlayer = (playerId: string) => {
    const player = getPlayer(playerId);
    if (!player) return;
    triggerConfirm(
      "Delete Player",
      `Are you sure you want to delete player "${player.name}"? This will clean up their fantasy squads and deliveries.`,
      async () => {
        setErrorMsg('');
        setSuccessMsg('');
        try {
          // 1. Remove from all fantasy teams
          const allFantasyTeams = await pb.collection('fantasy_teams').getFullList({ requestKey: null });
          const associatedFantasyTeams = allFantasyTeams.filter((ft: any) => (ft.players || []).includes(playerId));
          for (const ft of associatedFantasyTeams) {
            const updatedPlayers = (ft.players || []).filter((id: string) => id !== playerId);
            await pb.collection('fantasy_teams').update(ft.id, { players: updatedPlayers }, { requestKey: null });
          }

          // 2. Delete all deliveries where this player participated
          const associatedDeliveries = await pb.collection('deliveries').getFullList({
            filter: `striker = "${playerId}" || bawler = "${playerId}" || out_player = "${playerId}" || fielder = "${playerId}"`,
            fields: 'id',
            requestKey: null
          });
          for (const del of associatedDeliveries) {
            await pb.collection('deliveries').delete(del.id, { requestKey: null });
          }

          // 3. Delete player
          await pb.collection('players').delete(playerId);
          setSuccessMsg(`Player "${player.name}" was deleted successfully.`);
          refreshData();
        } catch (err: any) {
          setErrorMsg(err.message || 'Error deleting player.');
        }
      },
      { confirmText: 'Delete Player', isDanger: true }
    );
  };

  // Excel Import Handler
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setSuccessMsg('');
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        let importedTeamCount = 0;
        let importedPlayerCount = 0;
        const createdTeamsMap: Record<string, string> = {}; // short_name -> id

        // 1. Parse Teams Sheet
        if (wb.SheetNames.includes('Teams')) {
          const wsTeams = wb.Sheets['Teams'];
          const teamRows = XLSX.utils.sheet_to_json<{ name: string; short_name: string }>(wsTeams);

          for (const row of teamRows) {
            const name = row.name || '';
            const shortName = (row.short_name || '').toUpperCase().trim();
            if (!name || !shortName) continue;

            let existingTeam = teams.find(t => t.short_name === shortName);
            if (!existingTeam) {
              existingTeam = await pb.collection('teams').create<Team>({
                name,
                short_name: shortName,
                logo: ''
              }, { requestKey: null });
              importedTeamCount++;
            }
            createdTeamsMap[shortName] = existingTeam.id;
          }
        }

        // Fetch latest teams list to map short names to IDs
        const currentTeams = await pb.collection('teams').getFullList<Team>({ requestKey: null });
        currentTeams.forEach(t => {
          createdTeamsMap[t.short_name.toUpperCase()] = t.id;
        });

        // 2. Parse Players Sheet
        if (wb.SheetNames.includes('Players')) {
          const wsPlayers = wb.Sheets['Players'];
          const playerRows = XLSX.utils.sheet_to_json<{ name: string; role: string; team_short_name: string; epf_number?: string; epf?: string; 'EPF Number'?: string; 'epf number'?: string }>(wsPlayers);

          const teamPlayerCounts: Record<string, number> = {};
          players.forEach(p => {
            teamPlayerCounts[p.team] = (teamPlayerCounts[p.team] || 0) + 1;
          });

          for (const row of playerRows) {
            const name = row.name || '';
            const role = (row.role || 'Batter').trim();
            const teamShort = (row.team_short_name || '').toUpperCase().trim();
            // Flexible key lookup for player number/EPF column (handles epf, EPF Number, player_number, etc.)
            let epfNumber = '';
            const rowKeys = Object.keys(row);
            for (const key of rowKeys) {
              const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (
                normalizedKey === 'epf' || 
                normalizedKey === 'epfnumber' || 
                normalizedKey === 'epfno' || 
                normalizedKey === 'epfnum' ||
                normalizedKey === 'playernumber' ||
                normalizedKey === 'playerno' ||
                normalizedKey === 'number' ||
                normalizedKey === 'no'
              ) {
                const val = (row as any)[key];
                if (val !== undefined && val !== null) {
                  // Keep only digits, max 5 digits
                  epfNumber = val.toString().replace(/[^0-9]/g, '').substring(0, 5);
                }
                break;
              }
            }
            if (!name || !teamShort) continue;

            let normalizedRole: 'Batter' | 'Bawler' | 'All-Rounder' | 'Wicket Keeper' = 'Batter';
            const lowerRole = role.toLowerCase();
            if (lowerRole.includes('bowl') || lowerRole.includes('bawl')) {
              normalizedRole = 'Bawler';
            } else if (lowerRole.includes('all') || lowerRole.includes('rounder')) {
              normalizedRole = 'All-Rounder';
            } else if (lowerRole.includes('keep') || lowerRole.includes('wk')) {
              normalizedRole = 'Wicket Keeper';
            }

            const teamId = createdTeamsMap[teamShort];
            if (!teamId) continue;

            const count = teamPlayerCounts[teamId] || 0;
            if (count >= 15) {
              console.warn(`Skipping player "${name}" - Team "${teamShort}" already has 15 players.`);
              continue;
            }

            const existingPlayer = players.find(p => p.name.toLowerCase() === name.toLowerCase() && p.team === teamId);
            if (!existingPlayer) {
              await pb.collection('players').create({
                name,
                role: normalizedRole,
                team: teamId,
                photo: '',
                epf_number: epfNumber
              }, { requestKey: null });
              teamPlayerCounts[teamId] = count + 1;
              importedPlayerCount++;
            } else {
              // Update EPF number for existing players if provided in the Excel sheet
              if (epfNumber && existingPlayer.epf_number !== epfNumber) {
                await pb.collection('players').update(existingPlayer.id, {
                  epf_number: epfNumber
                }, { requestKey: null });
                importedPlayerCount++;
              }
            }
          }
        }

        setSuccessMsg(`Excel Import Complete! Created ${importedTeamCount} teams and processed ${importedPlayerCount} players.`);
        refreshData();
      } catch (err: any) {
        setErrorMsg(err.message || 'Error parsing Excel sheet. Make sure sheets "Teams" and "Players" match the template columns.');
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const handleStartMatch = async () => {
    if (!selectedMatch) return;
    // No longer compulsory to select exactly 11 players for both teams.
    // If not selected, the match will default to the full team roster.
    if (!battingFirst) {
      setErrorMsg('Please select which team bats first.');
      return;
    }
    if (!strikerId || !nonStrikerId || strikerId === nonStrikerId) {
      setErrorMsg('Please select two distinct opening batters.');
      return;
    }
    if (!bowlerId) {
      setErrorMsg('Please select the opening bowler.');
      return;
    }

    try {
      const bowlingTeamId = battingFirst === selectedMatch.team1 ? selectedMatch.team2 : selectedMatch.team1;

      // 1. Create Inning
      await pb.collection('innings').create<Inning>({
        match: selectedMatch.id,
        batting_team: battingFirst,
        bawling_team: bowlingTeamId,
        total_runs: 0,
        total_wickets: 0,
        total_overs: 0
      });

      // 2. Set Match Status to Live and Save Initial Squads
      await pb.collection('matches').update(selectedMatch.id, {
        status: 'Live',
        overs_limit: oversLimit,
        team1_squad: team1Squad,
        team2_squad: team2Squad
      });

      setSuccessMsg('Match started successfully!');
      fetchMatchInnings(selectedMatch.id, true);
      refreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error initializing match.');
    }
  };

  const recordBall = async (
    runs: number, 
    isExtra = false, 
    extraType: 'None' | 'Wide' | 'No Ball' | 'Bye' | 'Leg Bye' = 'None',
    runsOffBat?: number,
    forceExtra = false
  ) => {
    if (!selectedMatch || !activeInning) return;
    if (!strikerId || !nonStrikerId || !bowlerId) {
      setScorerErrorMsg('Please ensure Striker, Non-Striker, and Bowler are all selected.');
      setShowScorerErrorModal(true);
      return;
    }

    if (legalBallsCount >= oversLimit * 6) {
      setScorerErrorMsg('Overs limit reached for this inning. Please declare/end the inning.');
      setShowScorerErrorModal(true);
      return;
    }

    setErrorMsg('');
    try {
      const isWide = extraType === 'Wide';
      const isNoBall = extraType === 'No Ball';
      
      let finalRuns = runs;
      if (selectedMatch.special_extras) {
        if (isWide) finalRuns = runs; // preserve total runs (4 penalty + completed runs run)
      }
      
      const isLegal = selectedMatch.special_extras ? (!forceExtra) : (!isWide && !isNoBall);
      setForceExtraBall(false);

      // 1. Create Delivery
      const overNum = Math.floor(legalBallsCount / 6);
      const ballNum = isLegal ? ((legalBallsCount % 6) + 1) : 0;
      const finalRunsOffBat = runsOffBat !== undefined ? runsOffBat : (extraType === 'None' ? runs : 0);

      await pb.collection('deliveries').create<Delivery>({
        inning: activeInning.id,
        striker: strikerId,
        bawler: bowlerId,
        over_number: overNum,
        ball_number: ballNum,
        runs: finalRuns,
        runs_off_bat: finalRunsOffBat,
        is_extra: isExtra,
        extra_type: extraType,
        is_wicket: false,
        dismissal_type: 'None',
        out_player: '',
        fielder: ''
      });

      // 2. Update Inning totals in DB
      const newRuns = activeInning.total_runs + finalRuns;
      const newOversStr = isLegal 
        ? `${Math.floor((legalBallsCount + 1) / 6)}.${(legalBallsCount + 1) % 6}`
        : `${Math.floor(legalBallsCount / 6)}.${legalBallsCount % 6}`;

      await pb.collection('innings').update(activeInning.id, {
        total_runs: newRuns,
        total_overs: parseFloat(newOversStr)
      });

      // Clear bowler selection if this legal ball completed the over (ball 6)
      if (isLegal && (legalBallsCount + 1) % 6 === 0) {
        setBowlerId('');
      }

      // 3. Rotate strikers using robust XOR logic (resolves React state batching race conditions)
      const runsRun = selectedMatch.special_extras && (isWide || isNoBall)
        ? (isWide ? Math.max(0, finalRuns - 4) : Math.max(0, finalRuns - 6))
        : ((extraType === 'Wide' || extraType === 'No Ball') ? Math.max(0, finalRuns - 1) : finalRuns);
      const shouldSwap = runsRun % 2 === 1;
      const isOverComplete = isLegal && ballNum === 6;
      const netSwap = shouldSwap !== isOverComplete; // XOR!

      if (netSwap) {
        setStrikerId(nonStrikerId);
        setNonStrikerId(strikerId);
      }

      // 4. Over transition check (6 legal balls)
      if (isOverComplete) {
        // Reset bowler so new one must be selected
        setBowlerId('');
        setSuccessMsg('Over completed! Please select a new bowler.');
      }

      fetchMatchInnings(selectedMatch.id, false);
    } catch (err: any) {
      setScorerErrorMsg(err.message || 'Error recording delivery.');
      setShowScorerErrorModal(true);
    }
  };

  const handleWicketClick = () => {
    if (!strikerId || !nonStrikerId || !bowlerId) {
      setScorerErrorMsg('Please ensure all active players (Striker, Non-Striker, and Bowler) are selected.');
      setShowScorerErrorModal(true);
      return;
    }
    setOutPlayerId(strikerId); // default out player to striker
    setFielderId('');
    setDismissalType('Bawled');
    setRunoutCompletedRuns(0);
    setRunoutExtraType('None');
    setShowWicketModal(true);
  };

  const recordWicket = async () => {
    if (!selectedMatch || !activeInning) return;
    if (legalBallsCount >= oversLimit * 6) {
      setScorerErrorMsg('Overs limit reached for this inning. Please declare/end the inning.');
      setShowScorerErrorModal(true);
      return;
    }
    try {
      const isRunOut = dismissalType === 'Run Out';
      let runsVal = isRunOut 
        ? (runoutExtraType === 'Wide' || runoutExtraType === 'No Ball' ? 1 + runoutCompletedRuns : runoutCompletedRuns) 
        : 0;
      
      if (selectedMatch.special_extras && isRunOut) {
        if (runoutExtraType === 'Wide') runsVal = 4 + runoutCompletedRuns;
        if (runoutExtraType === 'No Ball') runsVal = 6 + runoutCompletedRuns;
      }

      let runsOffBatVal = 0;
      if (isRunOut) {
        if (runoutExtraType === 'None') {
          runsOffBatVal = runoutCompletedRuns;
        } else if (runoutExtraType === 'No Ball' && runoutNoBallType === 'Off Bat') {
          runsOffBatVal = runoutCompletedRuns;
        }
      }

      const isExtraVal = isRunOut ? runoutExtraType !== 'None' : false;
      const extraTypeVal = isRunOut ? runoutExtraType : 'None';
      const isRetiredOut = dismissalType === 'Retired Out';
      const isWicketVal = !isRetiredOut;
      const isLegal = isRetiredOut 
        ? false 
        : (selectedMatch.special_extras 
            ? true 
            : (isRunOut ? (runoutExtraType !== 'Wide' && runoutExtraType !== 'No Ball') : true));

      const overNum = Math.floor(legalBallsCount / 6);
      const ballNum = (legalBallsCount % 6) + 1;

      // 1. Create delivery
      await pb.collection('deliveries').create<Delivery>({
        inning: activeInning.id,
        striker: strikerId,
        bawler: bowlerId,
        over_number: overNum,
        ball_number: isLegal ? ballNum : (legalBallsCount % 6),
        runs: runsVal,
        runs_off_bat: runsOffBatVal,
        is_extra: isExtraVal,
        extra_type: extraTypeVal,
        is_wicket: isWicketVal,
        dismissal_type: dismissalType,
        out_player: outPlayerId,
        fielder: fielderId
      });

      // 2. Update Inning totals
      const newWickets = isRetiredOut ? activeInning.total_wickets : activeInning.total_wickets + 1;
      const newLegalBallsCount = isLegal ? legalBallsCount + 1 : legalBallsCount;
      const newOversStr = `${Math.floor(newLegalBallsCount / 6)}.${newLegalBallsCount % 6}`;

      await pb.collection('innings').update(activeInning.id, {
        total_runs: activeInning.total_runs + runsVal,
        total_wickets: newWickets,
        total_overs: parseFloat(newOversStr)
      });

      // 3. Clear the out batsman or rotate for over transition if ball 6
      let nextStriker = strikerId;
      let nextNonStriker = nonStrikerId;

      if (dismissalType === 'Run Out') {
        const isStrikerOut = outPlayerId === strikerId;
        const runsOdd = runoutCompletedRuns % 2 === 1;

        if (runsOdd) {
          if (isStrikerOut) {
            nextStriker = nonStrikerId;
            nextNonStriker = '';
          } else {
            nextStriker = '';
            nextNonStriker = strikerId;
          }
        } else {
          if (isStrikerOut) {
            nextStriker = '';
            nextNonStriker = nonStrikerId;
          } else {
            nextStriker = strikerId;
            nextNonStriker = '';
          }
        }
      } else {
        // Standard dismissal (e.g. Bowled, Caught, etc.) - striker is always the out player
        if (outPlayerId === strikerId) {
          nextStriker = '';
        } else {
          nextNonStriker = '';
        }
      }

      const isOverComplete = isLegal && ballNum === 6;
      if (isOverComplete) {
        // Swap ends at the end of the over
        const temp = nextStriker;
        nextStriker = nextNonStriker;
        nextNonStriker = temp;

        setStrikerId(nextStriker);
        setNonStrikerId(nextNonStriker);
        setBowlerId('');
        setSuccessMsg('Over completed! Please select a new bowler.');
      } else {
        setStrikerId(nextStriker);
        setNonStrikerId(nextNonStriker);
      }

      setShowWicketModal(false);
      fetchMatchInnings(selectedMatch.id, false);
    } catch (err: any) {
      setScorerErrorMsg(err.message || 'Error recording wicket.');
      setShowScorerErrorModal(true);
    }
  };

  const undoLastBall = async () => {
    if (!selectedMatch || inningDeliveries.length === 0) return;
    const lastDel = inningDeliveries[inningDeliveries.length - 1];

    try {
      // 1. Delete delivery record
      await pb.collection('deliveries').delete(lastDel.id);

      // 2. Recalculate inning totals
      const isLegal = selectedMatch.special_extras 
        ? true 
        : (lastDel.extra_type !== 'Wide' && lastDel.extra_type !== 'No Ball');
      const prevRuns = activeInning.total_runs - (lastDel.runs || 0);
      const prevWickets = lastDel.is_wicket ? activeInning.total_wickets - 1 : activeInning.total_wickets;
      
      const newLegalBallsCount = isLegal ? legalBallsCount - 1 : legalBallsCount;
      const prevOversStr = `${Math.floor(newLegalBallsCount / 6)}.${newLegalBallsCount % 6}`;

      await pb.collection('innings').update(activeInning.id, {
        total_runs: prevRuns,
        total_wickets: prevWickets,
        total_overs: parseFloat(prevOversStr)
      });

      // 3. Reverse batsman swaps from runs run & over transition
      const runsRun = selectedMatch.special_extras && (lastDel.extra_type === 'Wide' || lastDel.extra_type === 'No Ball')
        ? (lastDel.extra_type === 'Wide' ? Math.max(0, (lastDel.runs || 0) - 4) : Math.max(0, (lastDel.runs || 0) - 6))
        : ((lastDel.extra_type === 'Wide' || lastDel.extra_type === 'No Ball')
          ? Math.max(0, (lastDel.runs || 0) - 1)
          : (lastDel.runs || 0));

      const lastBallNum = (newLegalBallsCount % 6) + 1;

      if (!lastDel.is_wicket) {
        const shouldSwap = runsRun % 2 === 1;
        const isOverComplete = isLegal && lastBallNum === 6;
        const netSwap = shouldSwap !== isOverComplete; // XOR!

        if (netSwap) {
          const temp = strikerId;
          setStrikerId(nonStrikerId);
          setNonStrikerId(temp);
        }
      } else {
        // 4. Reverse wicket dismissal
        if (lastDel.out_player) {
          const prevStriker = lastDel.striker;
          const prevNonStriker = lastDel.out_player === lastDel.striker 
            ? (strikerId || nonStrikerId) 
            : lastDel.out_player;

          setStrikerId(prevStriker);
          setNonStrikerId(prevNonStriker);
        }
      }

      // Restore bowler who bowled that delivery
      if (lastDel.bawler) {
        setBowlerId(lastDel.bawler);
      }

      setSuccessMsg('Last ball undone and state reverted successfully.');
      if (selectedMatch) fetchMatchInnings(selectedMatch.id, false);
    } catch (err: any) {
      setScorerErrorMsg(err.message || 'Error undoing last ball.');
      setShowScorerErrorModal(true);
    }
  };

  const handleDeclareInning = () => {
    if (!selectedMatch || !activeInning) return;
    
    const isSuperOver = innings.length > 2;
    const confirmMsg = innings.length % 2 === 1
      ? `Are you sure you want to end ${isSuperOver ? 'Super Over ' : ''}Inning ${innings.length} and switch to Inning ${innings.length + 1}?`
      : `Are you sure you want to declare and end the match?`;

    triggerConfirm(
      innings.length % 2 === 1 ? "End Inning" : "Declare & End Match",
      confirmMsg,
      async () => {
        try {
          if (innings.length % 2 === 1) {
            // Start the next inning of this pair (e.g. Inning 2, 4, etc.)
            const nextBattingTeam = activeInning.bawling_team;
            const nextBowlingTeam = activeInning.batting_team;

            await pb.collection('innings').create<Inning>({
              match: selectedMatch.id,
              batting_team: nextBattingTeam,
              bawling_team: nextBowlingTeam,
              total_runs: 0,
              total_wickets: 0,
              total_overs: 0
            });

            setStrikerId('');
            setNonStrikerId('');
            setBowlerId('');
            setSuccessMsg(innings.length === 1 ? 'First inning complete. Setup the second inning!' : 'Super Over Inning 1 complete. Setup the chase!');
            fetchMatchInnings(selectedMatch.id, true);
          } else {
            // Both innings of the current pair are done - check results
            const idxFirst = innings.length - 2;
            const idxSecond = innings.length - 1;
            const firstInningDeliveries = deliveries.filter(d => d.inning === innings[idxFirst].id);
            const secondInningDeliveries = deliveries.filter(d => d.inning === innings[idxSecond].id);
            const firstInningRuns = firstInningDeliveries.reduce((sum, d) => sum + (d.runs || 0), 0);
            const secondInningRuns = secondInningDeliveries.reduce((sum, d) => sum + (d.runs || 0), 0);

            if (firstInningRuns !== secondInningRuns) {
              // Decisive score
              let matchWinner = '';
              if (firstInningRuns > secondInningRuns) {
                matchWinner = innings[idxFirst].batting_team;
              } else {
                matchWinner = innings[idxSecond].batting_team;
              }

              await pb.collection('matches').update(selectedMatch.id, {
                status: 'Completed',
                winner: matchWinner
              });

              await promoteWinnerInBracket(selectedMatch, matchWinner);

              setSelectedMatch(null);
              setSuccessMsg('Match completed successfully!');
              refreshData();
            } else {
              // Scores are level! Ask admin to start a Super Over
              const soNum = Math.floor((innings.length - 2) / 2) + 1;
              
              // We need to trigger this confirm box shortly after the current confirm closes
              setTimeout(() => {
                triggerConfirm(
                  "Scores Tied! Play Super Over?",
                  `Both teams ended on ${secondInningRuns} runs. Would you like to play Super Over ${soNum}?`,
                  async () => {
                    setSoSelectMatch(selectedMatch);
                    setSoRoundNumToCreate(soNum);
                    setShowSOBattingFirstSelectModal(true);
                  },
                  {
                    confirmText: "Play Super Over",
                    cancelText: "Declare Tie / Draw",
                    isDanger: false,
                    onCancel: async () => {
                      try {
                        await pb.collection('matches').update(selectedMatch.id, {
                          status: 'Completed',
                          winner: '' // Tie (no winner)
                        });

                        setSelectedMatch(null);
                        setSuccessMsg('Match declared as a Tie/Draw.');
                        refreshData();
                      } catch (err: any) {
                        setScorerErrorMsg(err.message || 'Error completing match.');
                        setShowScorerErrorModal(true);
                      }
                    }
                  }
                );
              }, 300);
            }
          }
        } catch (err: any) {
          setScorerErrorMsg(err.message || 'Error declaring inning.');
          setShowScorerErrorModal(true);
        }
      },
      {
        confirmText: innings.length % 2 === 1 ? "End Inning" : "Declare & End Match",
        isDanger: true
      }
    );
  };

  const handleRescheduleMatch = async () => {
    if (!selectedMatch) return;
    triggerConfirm(
      "Reset & Reschedule Match (Rain/Interruption)",
      `Are you sure you want to reset and reschedule "${selectedMatch.stage}"? ALL recorded innings, deliveries, and scores for this match will be deleted, and the match status will return to Upcoming for a fresh start.`,
      async () => {
        try {
          // Delete all innings and deliveries for this match
          const matchInnings = await pb.collection('innings').getFullList<Inning>({
            filter: `match="${selectedMatch.id}"`
          });
          for (const inn of matchInnings) {
            const innDels = await pb.collection('deliveries').getFullList<Delivery>({
              filter: `inning="${inn.id}"`
            });
            for (const d of innDels) {
              await pb.collection('deliveries').delete(d.id);
            }
            await pb.collection('innings').delete(inn.id);
          }

          // Reset match status to Upcoming
          await pb.collection('matches').update(selectedMatch.id, {
            status: 'Upcoming',
            winner: '',
            delay_reason: ''
          });

          setSelectedMatch(null);
          setInnings([]);
          setDeliveries([]);
          setSuccessMsg('Match reset successfully! Scheduled as Upcoming.');
          refreshData();
        } catch (err: any) {
          setScorerErrorMsg(err.message || 'Error rescheduling match.');
          setShowScorerErrorModal(true);
        }
      },
      { confirmText: "Reset & Reschedule Match", isDanger: true }
    );
  };

  const cascadeResetPromotions = async (completedMatch: Match) => {
    const parsed = parseStage(completedMatch.stage);
    if (parsed.round <= 1) return;

    const targetRound = parsed.round - 1;
    const targetMatchIndex = Math.ceil(parsed.matchIndex / 2);
    const slot = parsed.matchIndex % 2 !== 0 ? 'team1' : 'team2';

    const targetStageName = getStageName(targetRound, targetMatchIndex);
    const targetMatch = matches.find(m => m.stage === targetStageName);
    if (targetMatch) {
      await pb.collection('matches').update(targetMatch.id, {
        [slot]: null,
        status: 'Upcoming',
        winner: null
      });
      await cascadeResetPromotions(targetMatch);
    }
  };

  const handleUpdateMatchup = async (matchId: string, team1Id: string, team2Id: string) => {
    setErrorMsg('');
    setSuccessMsg('');

    if (team1Id && team2Id && team1Id === team2Id) {
      setErrorMsg("A team cannot play against itself.");
      return;
    }

    try {
      const matchObj = matches.find(m => m.id === matchId);
      if (!matchObj) return;

      let status: 'Upcoming' | 'Live' | 'Completed' = 'Upcoming';
      let winner = null;
      const t1 = team1Id || null;
      const t2 = team2Id || null;

      if (t1 && !t2) {
        status = 'Completed';
        winner = t1;
      } else if (!t1 && t2) {
        status = 'Completed';
        winner = t2;
      }

      // 1. Update the matchup
      await pb.collection('matches').update(matchId, {
        team1: t1,
        team2: t2,
        status,
        winner
      });

      // 2. Cascade promote/reset
      if (winner) {
        await promoteWinnerInBracket(matchObj, winner);
      } else {
        await cascadeResetPromotions(matchObj);
      }

      setSuccessMsg("Matchup updated successfully!");
      refreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating matchup.');
    }
  };

  const handleUpdateMatchTime = async (matchId: string, timeStr: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await pb.collection('matches').update(matchId, {
        match_time: timeStr
      });
      setSuccessMsg("Match date & time updated successfully!");
      refreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating match schedule.');
    }
  };

  const promoteWinnerInBracket = async (completedMatch: Match, winnerTeamId: string) => {
    try {
      const parsed = parseStage(completedMatch.stage);
      if (parsed.round <= 1) return;

      const targetRound = parsed.round - 1;
      const targetMatchIndex = Math.ceil(parsed.matchIndex / 2);
      const slot = parsed.matchIndex % 2 !== 0 ? 'team1' : 'team2';

      const targetStageName = getStageName(targetRound, targetMatchIndex);
      const targetMatch = matches.find(m => m.stage === targetStageName);
      if (targetMatch) {
        await pb.collection('matches').update(targetMatch.id, {
          [slot]: winnerTeamId
        });
      }
    } catch (err) {
      console.error('Bracket promotion error:', err);
    }
  };

  const isBowlerDisabled = (pId: string) => {
    if (!activeInning || inningDeliveries.length === 0) return false;
    
    // Find all legal deliveries in current inning
    const legalDels = inningDeliveries.filter(d => {
      if (selectedMatch?.special_extras) {
        return d.ball_number > 0;
      }
      return d.extra_type !== 'Wide' && d.extra_type !== 'No Ball';
    });

    const totalLegalCount = legalDels.length;

    // If an over has just completed (6, 12, 18, etc. legal balls)
    if (totalLegalCount > 0 && totalLegalCount % 6 === 0) {
      const lastLegalDel = legalDels[legalDels.length - 1];
      if (lastLegalDel && lastLegalDel.bawler === pId) {
        return true; // Cannot bowl 2 consecutive overs!
      }
    }
    return false;
  };

  interface ScorerTickerItem {
    type: 'ball' | 'over-divider';
    id: string;
    label: string;
    badgeClass: string;
    overNum?: number;
    overRuns?: number;
  }

  const getRecentBallsTicker = (inningDels: Delivery[], isInningComplete = false) => {
    const overRunsMap: Record<number, number> = {};
    inningDels.forEach(d => {
      overRunsMap[d.over_number] = (overRunsMap[d.over_number] || 0) + (d.runs || 0);
    });

    const chronoItems: ScorerTickerItem[] = [];
    inningDels.forEach((d, idx) => {
      let label = `${d.runs}`;
      let badgeClass = "bg-slate-800 text-slate-300 border border-slate-700/60";

      if (d.dismissal_type === 'Retired Out') {
        label = "Ret";
        badgeClass = "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold";
      } else if (d.is_wicket) {
        if (d.dismissal_type === 'Run Out') {
          const isWide = d.extra_type === 'Wide';
          const isNoBall = d.extra_type === 'No Ball';
          const isSpecialExtras = selectedMatch?.special_extras || false;
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
        badgeClass = "bg-slate-800 text-amber-500 border border-slate-755 font-semibold";
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

      const nextDel = inningDels[idx + 1];
      if (nextDel && nextDel.over_number !== d.over_number) {
        const overRuns = overRunsMap[d.over_number] || 0;
        chronoItems.push({
          type: 'over-divider',
          id: `div-${d.over_number}`,
          label: getOrdinal(d.over_number + 1),
          badgeClass: "",
          overNum: d.over_number + 1,
          overRuns
        });
      }
    });

    // Check if we need to add the final over divider (if the over is completed or inning complete)
    if (inningDels.length > 0) {
      const lastDel = inningDels[inningDels.length - 1];
      const dividerExists = chronoItems.some(item => item.type === 'over-divider' && item.id === `div-${lastDel.over_number}`);
      if (!dividerExists) {
        if (lastDel.ball_number === 6 || isInningComplete) {
          const overRuns = overRunsMap[lastDel.over_number] || 0;
          chronoItems.push({
            type: 'over-divider',
            id: `div-${lastDel.over_number}`,
            label: getOrdinal(lastDel.over_number + 1),
            badgeClass: "",
            overNum: lastDel.over_number + 1,
            overRuns
          });
        }
      }
    }

    return chronoItems;
  };

  const renderCommentaryText = (d: Delivery) => {
    const runs = d.runs || 0;
    
    if (d.is_wicket) {
      const fielderName = d.fielder ? formatPlayerName(d.fielder) : '';
      if (d.dismissal_type === 'Bawled') {
        return 'OUT! Bowled clean!';
      } else if (d.dismissal_type === 'Catch') {
        return `OUT! Caught by ${fielderName || 'fielder'}.`;
      } else if (d.dismissal_type === 'Run Out') {
        const isWide = d.extra_type === 'Wide';
        const isNoBall = d.extra_type === 'No Ball';
        const isSpecialExtras = selectedMatch?.special_extras || false;
        const completedRuns = isSpecialExtras
          ? (isWide ? Math.max(0, runs - 4) : (isNoBall ? Math.max(0, runs - 6) : runs))
          : (isWide || isNoBall ? Math.max(0, runs - 1) : runs);
        
        let msg = `OUT! Run out by ${fielderName || 'fielder'}.`;
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
        if (d.extra_type !== 'None') {
          msg += ` (${d.extra_type})`;
        }
        return msg;
      } else if (d.dismissal_type === 'Stumped') {
        return `OUT! Stumped by ${fielderName || 'fielder'}.`;
      } else if (d.dismissal_type === 'Hit Wicket') {
        return 'OUT! Hit Wicket.';
      } else if (d.dismissal_type === 'Retired Out') {
        return 'Retired Out. Batter leaves the field to the dugout (no ball consumed).';
      }
      return 'OUT!';
    }
    
    if (d.is_extra) {
      if (d.extra_type === 'Wide') {
        const baseWide = selectedMatch?.special_extras ? 4 : 1;
        const completed = runs - baseWide;
        const isReBowl = d.ball_number === 0;
        return selectedMatch?.special_extras 
          ? (isReBowl
            ? (completed > 0
              ? `Wide. Batters ran ${completed} bye(s) (${runs} runs total, extra ball required).`
              : `Wide (4 runs, extra ball required).`)
            : (completed > 0
              ? `Wide. Batters ran ${completed} bye(s) (${runs} runs total, counted as legal ball).`
              : `Wide (4 runs, counted as legal ball).`))
          : (completed > 0
            ? `Wide. Batters ran ${completed} bye(s) (${runs} runs total).`
            : `Wide. 1 run total.`);
      } else if (d.extra_type === 'No Ball') {
        const baseNB = selectedMatch?.special_extras ? 6 : 1;
        const completed = runs - baseNB;
        const runOffBat = d.runs_off_bat !== undefined && d.runs_off_bat !== null 
          ? d.runs_off_bat 
          : (selectedMatch?.special_extras ? Math.max(0, runs - 6) : Math.max(0, runs - 1));
        const isReBowl = d.ball_number === 0;
        
        if (selectedMatch?.special_extras) {
          if (isReBowl) {
            if (completed > 0) {
              if (runOffBat > 0) {
                return `No Ball. Batsman scored ${runOffBat} run(s) off bat (${runs} runs total, extra ball required).`;
              } else {
                return `No Ball. Batters ran ${completed} bye(s) (${runs} runs total, extra ball required).`;
              }
            } else {
              return `No Ball (6 runs, extra ball required).`;
            }
          } else {
            if (completed > 0) {
              if (runOffBat > 0) {
                return `No Ball. Batsman scored ${runOffBat} run(s) off bat (${runs} runs total, counted as legal ball).`;
              } else {
                return `No Ball. Batters ran ${completed} bye(s) (${runs} runs total, counted as legal ball).`;
              }
            } else {
              return `No Ball (6 runs, counted as legal ball).`;
            }
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

  const getInningScorecardState = () => {
    if (!activeInning) return null;
    
    let tRuns = 0;
    let tWkts = 0;
    let tBalls = 0;
    
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

    inningDeliveries.forEach((d) => {
      const runs = d.runs || 0;
      tRuns += runs;

      if (d.is_wicket) {
        tWkts += 1;
      }

      const isWide = d.extra_type === 'Wide';
      const isNoBall = d.extra_type === 'No Ball';
      const isRetiredOut = d.dismissal_type === 'Retired Out';
      const isLegal = isRetiredOut 
        ? false 
        : (selectedMatch?.special_extras ? (d.ball_number > 0) : (!isWide && !isNoBall));

      if (isLegal) {
        tBalls += 1;
      }

      const baseWide = selectedMatch?.special_extras ? 4 : 1;
      const baseNB = selectedMatch?.special_extras ? 6 : 1;
      const runOffBat = d.runs_off_bat !== undefined && d.runs_off_bat !== null
        ? d.runs_off_bat
        : (d.extra_type === 'Bye' || d.extra_type === 'Leg Bye'
          ? 0
          : (isNoBall
            ? (selectedMatch?.special_extras ? Math.max(0, runs - 6) : Math.max(0, runs - 1))
            : (isWide ? 0 : runs)));

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

        if (d.is_wicket && d.out_player) {
          const bowlerName = players.find(p => p.id === d.bawler)?.name || 'Bowler';
          const fielderName = players.find(p => p.id === d.fielder)?.name || 'Fielder';

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
      }
    });

    return {
      totalRuns: tRuns,
      totalWickets: tWkts,
      totalBalls: tBalls,
      oversStr: `${Math.floor(tBalls / 6)}.${tBalls % 6}`,
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
      totalExtras: extrasWides + extrasNoBalls + extrasByes + extrasLegByes
    };
  };

  const getTeamSelectionInfo = (teamId: string, currentMatchId: string) => {
    if (!teamId) return '';
    const currentMatch = matches.find(m => m.id === currentMatchId);
    if (!currentMatch) return '';
    const currentRound = parseStage(currentMatch.stage).round;

    const selections: string[] = [];

    matches.forEach(m => {
      const parsed = parseStage(m.stage);
      if (parsed.round !== currentRound) return;

      const t1 = selectedDrawTeams[m.id]?.team1 !== undefined ? selectedDrawTeams[m.id].team1 : (m.team1 || '');
      const t2 = selectedDrawTeams[m.id]?.team2 !== undefined ? selectedDrawTeams[m.id].team2 : (m.team2 || '');

      if (m.id === currentMatchId) {
        // do not check ourselves
      } else {
        if (t1 === teamId) {
          selections.push(`${m.stage} - Team 1`);
        }
        if (t2 === teamId) {
          selections.push(`${m.stage} - Team 2`);
        }
      }
    });

    if (selections.length > 0) {
      return ` [Already in: ${selections.join(', ')}]`;
    }
    return '';
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
           {/* HEADER TABS (Scorer Panel vs Manage Panel) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent m-0">
            {activeSubView === 'scorer' ? 'Scorer Control Panel' : activeSubView === 'manage' ? 'Tournament Administration' : activeSubView === 'draw' ? 'Bracket Draw Designer' : 'News & Gallery Manager'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {activeSubView === 'scorer' ? 'Select matches, set squads, and record scores' : activeSubView === 'manage' ? 'Add, edit, delete or Excel import teams and players' : activeSubView === 'draw' ? 'Design and set corporate team matchups for the Quarter Finals' : 'Post news, announcements, and match highlights'}
          </p>
        </div>

        {/* Toggle subviews */}
        <div className="w-full sm:w-auto flex gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 overflow-x-auto scrollbar-none shrink-0">
          {role === 'superuser' ? (
            <>
              <button
                onClick={() => { setSubView('scorer'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  subView === 'scorer'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Live Scoring
              </button>
              <button
                onClick={() => { setSubView('manage'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  subView === 'manage'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Roster & Admin
              </button>
              <button
                onClick={() => { setSubView('draw'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  subView === 'draw'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Draw Designer
              </button>
              <button
                onClick={() => { setSubView('news'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  subView === 'news'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                News & Gallery
              </button>
            </>
          ) : role === 'news' ? (
            <button
              className="px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 shrink-0 cursor-not-allowed"
              disabled
            >
              News Manager Mode
            </button>
          ) : (
            <button
              className="px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 shrink-0 cursor-not-allowed"
              disabled
            >
              Live Scorer Mode
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-300 p-4 rounded-xl text-xs mb-6">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-4 rounded-xl text-xs mb-6">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* -------------------- ADD TEAMS & PLAYERS VIEW -------------------- */}
      {activeSubView === 'manage' && (
        <div className="space-y-10">
          
          {/* Excel Import Box */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Excel Data Import</h3>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-lg leading-relaxed">
                    Import multiple teams and player lists instantly. Prepare an Excel file with sheets named <strong>"Teams"</strong> (columns: <code>name</code>, <code>short_name</code>) and <strong>"Players"</strong> (columns: <code>name</code>, <code>role</code>, <code>team_short_name</code>, <code>epf_number</code> or <code>player_number</code>).
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={handleCleanAllTeamsAndPlayers}
                  className="flex items-center gap-2 px-4 py-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 hover:text-rose-200 text-xs font-bold rounded-xl cursor-pointer transition-all shadow-md shadow-rose-950/10 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clean All Teams & Players</span>
                </button>

                <label className="flex items-center gap-2 px-4 py-3 bg-slate-950/60 border border-slate-800 hover:border-emerald-500/30 text-xs font-bold text-slate-300 hover:text-emerald-300 rounded-xl cursor-pointer transition-all shrink-0">
                  <Upload className="w-4 h-4" />
                  <span>Choose Excel File</span>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleExcelImport}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Add Team Card */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 space-y-4">
              <h3 className="text-md font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
                <Plus className="w-4 h-4 text-emerald-400" />
                Add Corporate Team
              </h3>

              <form onSubmit={handleAddTeam} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Team Name</label>
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="e.g. Finance Falcons"
                    required
                    className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl py-2.5 px-4 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Short Name (Max 8 Letters)</label>
                  <input
                    type="text"
                    maxLength={8}
                    value={newTeamShortName}
                    onChange={(e) => setNewTeamShortName(e.target.value.toUpperCase())}
                    placeholder="e.g. DYE-A"
                    required
                    className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl py-2.5 px-4 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Team Logo</label>
                  <input
                    id="team-logo-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setNewTeamLogo(e.target.files?.[0] || null)}
                    className="w-full bg-slate-950/40 border border-slate-800/60 text-slate-400 py-1.5 px-3 rounded-xl text-xs cursor-pointer focus:outline-none file:bg-slate-800 file:border-0 file:rounded file:text-xs file:font-semibold file:text-slate-300 file:px-2.5 file:py-1 file:mr-2 file:cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer hover:from-emerald-400 hover:to-teal-400 shadow-md transition-all"
                >
                  Create Team
                </button>
              </form>
            </div>

            {/* Add Player Card */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 space-y-4">
              <h3 className="text-md font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
                <Users className="w-4 h-4 text-emerald-400" />
                Register Player Roster
              </h3>

              <form onSubmit={handleAddPlayer} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Player Name</label>
                  <input
                    type="text"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder="e.g. John Doe"
                    required
                    className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl py-2.5 px-4 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Player Number (Optional)</label>
                  <input
                    type="text"
                    value={newPlayerEpf}
                    onChange={(e) => setNewPlayerEpf(e.target.value.replace(/[^0-9]/g, '').substring(0, 5))}
                    placeholder="e.g. 12345"
                    maxLength={5}
                    className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl py-2.5 px-4 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select Team</label>
                    <select
                      value={newPlayerTeamId}
                      onChange={(e) => setNewPlayerTeamId(e.target.value)}
                      required
                      className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl py-2.5 px-3 text-xs text-slate-300"
                    >
                      <option value="">Select Team</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.short_name})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Player Role</label>
                    <select
                      value={newPlayerRole}
                      onChange={(e) => setNewPlayerRole(e.target.value as any)}
                      className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl py-2.5 px-3 text-xs text-slate-300"
                    >
                      <option value="Batter">Batter</option>
                      <option value="Bawler">Bowler</option>
                      <option value="All-Rounder">All-Rounder</option>
                      <option value="Wicket Keeper">Wicket Keeper</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Profile Photo (Optional)</label>
                  <input
                    id="player-photo-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setNewPlayerPhoto(e.target.files?.[0] || null)}
                    className="w-full bg-slate-950/40 border border-slate-800/60 text-slate-400 py-1.5 px-3 rounded-xl text-xs cursor-pointer focus:outline-none file:bg-slate-800 file:border-0 file:rounded file:text-xs file:font-semibold file:text-slate-300 file:px-2.5 file:py-1 file:mr-2 file:cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer hover:from-emerald-400 hover:to-teal-400 shadow-md transition-all"
                >
                  Register Player
                </button>
              </form>
            </div>

          </div>

          {/* Tournament Configuration Card */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 relative overflow-hidden space-y-4 mb-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-md font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Settings className="w-4 h-4 text-emerald-400" />
              Tournament Configuration
            </h3>
            
            <div className="space-y-4 mt-2">
              <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-200 block">Show Player Numbers</span>
                  <span className="text-[10px] text-slate-500 block">Append player number next to player name (e.g. Name - 1234) across the scoreboard and leaderboards</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const newShowEpf = !showEpfNumber;
                    setShowEpfNumber(newShowEpf);
                    setIsSavingConfig(true);
                    setErrorMsg('');
                    setSuccessMsg('');
                    try {
                      const data = {
                        man_of_the_series: mosPlayerId || null,
                        mos_performance: mosPerformance.trim() || '',
                        show_epf_number: newShowEpf,
                        strict_fantasy_roles: strictFantasyRoles,
                        stats_from_phase: statsFromPhase
                      };
                      if (tournamentConfig) {
                        await pb.collection('tournament_config').update(tournamentConfig.id, data);
                      } else {
                        await pb.collection('tournament_config').create(data);
                      }
                      setSuccessMsg(`Player number visibility toggled ${newShowEpf ? 'ON' : 'OFF'}!`);
                      refreshData();
                    } catch (err: any) {
                      setErrorMsg(err.message || 'Error updating configuration.');
                    } finally {
                      setIsSavingConfig(false);
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                    showEpfNumber ? 'bg-emerald-500' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showEpfNumber ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-200 block">Strict Fantasy Roles (IPL Rules)</span>
                  <span className="text-[10px] text-slate-500 block">Enforce strict roster quotas (1-4 WKs, 3-6 Batters, etc.). Turn OFF to allow selecting any 11 players for soft-ball cricket</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const newStrict = !strictFantasyRoles;
                    setStrictFantasyRoles(newStrict);
                    setIsSavingConfig(true);
                    setErrorMsg('');
                    setSuccessMsg('');
                    try {
                      const data = {
                        man_of_the_series: mosPlayerId || null,
                        mos_performance: mosPerformance.trim() || '',
                        show_epf_number: showEpfNumber,
                        strict_fantasy_roles: newStrict,
                        stats_from_phase: statsFromPhase
                      };
                      if (tournamentConfig) {
                        await pb.collection('tournament_config').update(tournamentConfig.id, data);
                      } else {
                        await pb.collection('tournament_config').create(data);
                      }
                      setSuccessMsg(`Strict roles toggled ${newStrict ? 'ON' : 'OFF'}!`);
                      refreshData();
                    } catch (err: any) {
                      setErrorMsg(err.message || 'Error updating configuration.');
                    } finally {
                      setIsSavingConfig(false);
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                    strictFantasyRoles ? 'bg-emerald-500' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      strictFantasyRoles ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-200 block">Calculate Tournament Stats From Phase</span>
                  <span className="text-[10px] text-slate-500 block">Filter leaderboard calculation from start of tournament or specific knockout rounds</span>
                </div>
                <select
                  value={statsFromPhase}
                  onChange={async (e) => {
                    const newPhase = e.target.value as 'All' | 'Quarter Finals' | 'Semi Finals';
                    setStatsFromPhase(newPhase);
                    setIsSavingConfig(true);
                    setErrorMsg('');
                    setSuccessMsg('');
                    try {
                      const data = {
                        man_of_the_series: mosPlayerId || null,
                        mos_performance: mosPerformance.trim() || '',
                        show_epf_number: showEpfNumber,
                        strict_fantasy_roles: strictFantasyRoles,
                        stats_from_phase: newPhase
                      };
                      if (tournamentConfig) {
                        await pb.collection('tournament_config').update(tournamentConfig.id, data);
                      } else {
                        await pb.collection('tournament_config').create(data);
                      }
                      setSuccessMsg(`Stats calculation phase set to "${newPhase}"!`);
                      refreshData();
                    } catch (err: any) {
                      setErrorMsg(err.message || 'Error updating configuration.');
                    } finally {
                      setIsSavingConfig(false);
                    }
                  }}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50 cursor-pointer shrink-0"
                >
                  <option value="All">All Tournament (Since Start)</option>
                  <option value="Quarter Finals">From Quarter-Finals Onwards</option>
                  <option value="Semi Finals">From Semi-Finals Onwards</option>
                </select>
              </div>

              <button
                type="button"
                disabled={isExporting}
                onClick={handleExportReport}
                className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-lg hover:shadow-emerald-500/5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Exporting Tournament Report...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Export Tournament Report (.xlsx)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Man of the Series Card */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-md font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Trophy className="w-4 h-4 text-amber-400" />
              Accolades: Man of the Series
            </h3>

            <form onSubmit={handleSaveTournamentConfig} className="space-y-6 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select Player</label>
                  <select
                    value={mosPlayerId}
                    onChange={(e) => setMosPlayerId(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl py-2.5 px-3 text-xs text-slate-350 focus:outline-none focus:border-amber-500/40"
                  >
                    <option value="">-- None Selected --</option>
                    {teams.map((team) => {
                      const teamPlayers = players.filter((p) => p.team === team.id);
                      if (teamPlayers.length === 0) return null;
                      return (
                        <optgroup key={team.id} label={team.name}>
                          {teamPlayers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {formatPlayerName(p)} ({p.role})
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">Select the player who earned the Man of the Series award.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Performance Details</label>
                  <textarea
                    placeholder="e.g. Outstanding all-round performance with 245 runs and 8 wickets."
                    value={mosPerformance}
                    onChange={(e) => setMosPerformance(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500/40 placeholder:text-slate-650 resize-y"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingConfig}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer hover:from-amber-400 hover:to-yellow-400 shadow-md transition-all disabled:opacity-50"
              >
                {isSavingConfig ? 'Saving Accolade...' : 'Save Man of the Series Accolade'}
              </button>
            </form>
          </div>

          {/* EDIT & DELETE ROSTER LISTINGS */}
          <div className="space-y-6">
            <h3 className="text-md font-bold text-slate-200 border-b border-slate-800 pb-3">Existing Teams & Roster Lists</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
              
              {/* Teams List (Column 1) */}
              <div className="md:col-span-1 glass-panel p-5 rounded-2xl border border-slate-800/80 space-y-4">
                <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Teams Registered ({teams.length})</span>
                <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                  {teams.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-900/60">
                      <div className="flex items-center gap-2">
                        {getTeamLogo(t) ? (
                          <img 
                            src={getTeamLogo(t)} 
                            alt={t.short_name}
                            className="w-6 h-6 rounded-md object-cover border border-slate-800"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-md bg-slate-900 border border-slate-850 flex items-center justify-center text-[9px] font-bold text-slate-400">
                            {t.short_name}
                          </div>
                        )}
                        <span className="text-xs font-semibold text-slate-200">{t.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setEditingTeam(t);
                            setEditTeamName(t.name);
                            setEditTeamShortName(t.short_name);
                            setEditTeamCaptainId(t.captain || '');
                          }}
                          className="p-1 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                          title="Edit Team"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTeam(t.id)}
                          className="p-1 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Delete Team"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {teams.length === 0 && <div className="text-center py-6 text-xs text-slate-500">No teams added yet</div>}
                </div>
              </div>

              {/* Roster Players View (Column 2 & 3) */}
              <div className="md:col-span-2 glass-panel p-5 rounded-2xl border border-slate-800/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/50 pb-3">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Roster Players</span>
                  
                  {/* Select team to view its players */}
                  <select
                    value={rosterTeamId}
                    onChange={(e) => setRosterTeamId(e.target.value)}
                    className="bg-slate-950/60 border border-slate-800 rounded-lg py-1 px-3 text-xs text-slate-300"
                  >
                    <option value="">Choose Team</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1">
                  {getTeamPlayers(rosterTeamId).map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-900/60">
                      <div className="flex items-center gap-2.5">
                        {p.photo ? (
                          <img 
                            src={getFileUrl('players', p.id, p.photo)} 
                            alt={p.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-800"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-850 flex items-center justify-center text-[10px] font-bold text-slate-500">
                            {p.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-semibold text-slate-200">
                            {p.name} {p.epf_number && <span className="text-slate-400 font-normal"> - {p.epf_number}</span>}
                          </div>
                          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{p.role}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingPlayer(p);
                            setEditPlayerName(p.name);
                            setEditPlayerRole(p.role);
                            setEditPlayerTeamId(p.team);
                            setEditPlayerEpf(p.epf_number || '');
                          }}
                          className="p-1 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                          title="Edit Player"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePlayer(p.id)}
                          className="p-1 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Delete Player"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {rosterTeamId && getTeamPlayers(rosterTeamId).length === 0 && (
                    <div className="sm:col-span-2 text-center py-12 text-xs text-slate-500">No players registered on this team roster yet</div>
                  )}
                  {!rosterTeamId && (
                    <div className="sm:col-span-2 text-center py-12 text-xs text-slate-500">Please choose a team above to view players</div>
                  )}
                </div>
              </div>
            </div>
          </div>

            {/* -------------------- PORTAL USERS MANAGEMENT (SUPERUSERS ONLY) -------------------- */}
            {role === 'superuser' && (
              <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 mt-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                <h3 className="text-base font-bold text-slate-100 mb-2 flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-450" />
                  Manage Portal Users & Credentials
                </h3>
                <p className="text-xs text-slate-400 max-w-3xl leading-relaxed mb-6">
                  Create sub-accounts for Live Scoring and News Room updates. Scoring roles are restricted strictly to updating scoreboards, while News roles can only manage gallery news.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Create User Form */}
                  <div className="md:col-span-1 space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800/60 pb-2">
                      Create New Account
                    </h4>
                    
                    <form onSubmit={handleCreateUser} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Full Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. John Doe"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          className="w-full bg-slate-950/60 border border-slate-850 rounded-xl py-2 px-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Username (Prefix)</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. johndoe"
                          value={newUserUsername}
                          onChange={(e) => setNewUserUsername(e.target.value)}
                          className="w-full bg-slate-950/60 border border-slate-850 rounded-xl py-2 px-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-455 uppercase mb-1.5">Password</label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          className="w-full bg-slate-950/60 border border-slate-850 rounded-xl py-2 px-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-455 uppercase mb-1.5">Account Role</label>
                        <select
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value as 'scorer' | 'news' | 'display')}
                          className="w-full bg-slate-950/60 border border-slate-850 rounded-xl py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                        >
                          <option value="scorer">Live Scorer Only</option>
                          <option value="news">News Manager Only</option>
                          <option value="display">Scoreboard TV/LED Display Only</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        disabled={isCreatingUser}
                        className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-extrabold text-xs rounded-xl hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/5"
                      >
                        {isCreatingUser ? 'Creating...' : (
                          <>
                            <Plus className="w-4 h-4" />
                            <span>Create Account</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  {/* Registered Users List */}
                  <div className="md:col-span-2 space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800/60 pb-2">
                      Registered Sub-Accounts ({portalUsers.length})
                    </h4>
                    
                    <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                      {portalUsers.map((user) => {
                        const email = user.email || '';
                        const resolvedRole = email.includes('news') || email.includes('media') || email.includes('pr')
                          ? 'news'
                          : email.includes('display') || email.includes('screen') || email.includes('led')
                            ? 'display'
                            : 'scorer';
                        
                        return (
                          <div key={user.id} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/40 border border-slate-900/60">
                            <div>
                              <div className="text-xs font-bold text-slate-200">{user.name || 'Unnamed User'}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{email}</div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                resolvedRole === 'news'
                                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                  : resolvedRole === 'display'
                                    ? 'bg-violet-500/10 text-violet-300 border-violet-500/20'
                                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                              }`}>
                                {resolvedRole === 'news' ? 'News Manager' : resolvedRole === 'display' ? 'Display User' : 'Live Scorer'}
                              </span>
                              
                              <button
                                onClick={() => handleDeleteUser(user.id, user.name || user.email)}
                                className="p-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-850 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                                title="Delete Account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      
                      {portalUsers.length === 0 && (
                        <div className="text-center py-12 text-xs text-slate-500 border border-dashed border-slate-850 rounded-xl bg-slate-950/10">
                          No sub-accounts registered yet. Create one on the left.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}      {/* -------------------- BRACKET DRAW DESIGNER VIEW -------------------- */}
      {activeSubView === 'draw' && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-base font-bold text-slate-100 mb-2 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-emerald-400" />
              Tournament Schedule & Bracket Configurator
            </h3>
            <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
              Define corporate team pairings for the opening round matches and assign dates & times to all matches.
              Modifying first-round matchups will automatically cascade reset downstream stages to preserve bracket integrity.
            </p>
          </div>

          {matches.length === 0 ? (
            (() => {
              const N = teams.length;
              let P = 2;
              while (P < N) {
                P *= 2;
              }
              const numByes = P - N;

              return (
                <div className="glass-panel p-6 border border-slate-800/80 rounded-3xl bg-slate-900/10 space-y-6 max-w-2xl mx-auto">
                  <div className="text-center space-y-2">
                    <Trophy className="w-12 h-12 text-emerald-500/80 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-slate-205 uppercase tracking-wider">Initialize Tournament Bracket</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                      To design the knockout draw, you must initialize the bracket matches for the registered {teams.length} teams.
                    </p>
                  </div>

                  {numByes > 0 && (
                    <div className="space-y-4 border-t border-slate-800/60 pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Select Bye Teams</h4>
                          <span className="text-[10px] text-slate-500 mt-1 block">
                            Choose exactly {numByes} team{numByes > 1 ? 's' : ''} to receive a bye (pass directly to next round).
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRandomizeByes}
                          className="px-2.5 py-1 bg-slate-850 border border-slate-750 text-[10px] font-bold text-slate-355 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          Randomize Byes
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
                        {teams.map((team) => {
                          const isChecked = selectedByeTeams.includes(team.id);
                          return (
                            <button
                              key={team.id}
                              type="button"
                              onClick={() => {
                                if (isChecked) {
                                  setSelectedByeTeams(prev => prev.filter(id => id !== team.id));
                                } else {
                                  if (selectedByeTeams.length < numByes) {
                                    setSelectedByeTeams(prev => [...prev, team.id]);
                                  }
                                }
                              }}
                              className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                isChecked
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                  : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-205 hover:border-slate-700'
                              }`}
                            >
                              <div className="shrink-0">
                                {isChecked ? (
                                  <div className="w-4 h-4 rounded bg-emerald-505 flex items-center justify-center text-slate-950">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  </div>
                                ) : (
                                  <div className="w-4 h-4 rounded border border-slate-700 bg-slate-900/50" />
                                )}
                              </div>
                              <span className="text-[11px] font-bold truncate">{team.name}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-500">Selection Progress:</span>
                        <span className={selectedByeTeams.length === numByes ? 'text-emerald-450' : 'text-amber-450'}>
                          {selectedByeTeams.length} of {numByes} selected
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleInitializeBracket}
                    disabled={isInitializingBracket || (numByes > 0 && selectedByeTeams.length !== numByes)}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-colors shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isInitializingBracket ? 'Initializing...' : 'Initialize Bracket Matches'}
                  </button>
                </div>
              );
            })()
          ) : (
            <div className="space-y-10">
              <div className="flex justify-end mb-2">
                <button
                  onClick={handleResetBracket}
                  className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-950/20"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Bracket & Start Fresh
                </button>
              </div>

              {Array.from({ length: totalRounds }, (_, roundIdx) => {
                const roundNum = totalRounds - roundIdx;
                const roundMatches = matches
                  .filter(m => parseStage(m.stage).round === roundNum)
                  .sort((a, b) => parseStage(a.stage).matchIndex - parseStage(b.stage).matchIndex);

                if (roundMatches.length === 0) return null;

                return (
                  <div key={roundNum} className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400 border-l-2 border-emerald-500 pl-2">
                      {getRoundName(roundNum)}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
                      {roundMatches.map((match) => {
                        const parsed = parseStage(match.stage);

                        const t1Val = selectedDrawTeams[match.id]?.team1 !== undefined ? selectedDrawTeams[match.id].team1 : (match.team1 || '');
                        const t2Val = selectedDrawTeams[match.id]?.team2 !== undefined ? selectedDrawTeams[match.id].team2 : (match.team2 || '');

                        const team1Obj = getTeam(t1Val);
                        const team2Obj = getTeam(t2Val);

                        const isFirstRound = parsed.round === totalRounds;
                        
                        let eligibleTeams1: Team[] = [];
                        let eligibleTeams2: Team[] = [];
                        
                        if (isFirstRound) {
                          eligibleTeams1 = teams;
                          eligibleTeams2 = teams;
                        } else {
                          const prevRoundNum = parsed.round + 1;
                          
                          // Find feeding match for team1
                          const stage1Name = getStageName(prevRoundNum, 2 * parsed.matchIndex - 1);
                          const feed1 = matches.find(m => m.stage === stage1Name);
                          if (feed1) {
                            const candidates = feed1.winner 
                              ? [feed1.winner] 
                              : [feed1.team1, feed1.team2].filter(Boolean) as string[];
                            if (match.team1) candidates.push(match.team1);
                            if (t1Val) candidates.push(t1Val);
                            eligibleTeams1 = teams.filter(t => candidates.includes(t.id));
                          }
                          
                          // Find feeding match for team2
                          const stage2Name = getStageName(prevRoundNum, 2 * parsed.matchIndex);
                          const feed2 = matches.find(m => m.stage === stage2Name);
                          if (feed2) {
                            const candidates = feed2.winner 
                              ? [feed2.winner] 
                              : [feed2.team1, feed2.team2].filter(Boolean) as string[];
                            if (match.team2) candidates.push(match.team2);
                            if (t2Val) candidates.push(t2Val);
                            eligibleTeams2 = teams.filter(t => candidates.includes(t.id));
                          }
                        }

                        const isMatchLocked = match.status === 'Live' || (match.status === 'Completed' && !!match.team1 && !!match.team2);

                        // Next stage routing description
                        let routingText = "";
                        if (parsed.round > 1) {
                          const targetIndex = Math.ceil(parsed.matchIndex / 2);
                          const targetRoundName = getRoundName(parsed.round - 1);
                          routingText = `Winner advances to ${targetRoundName} - Match ${targetIndex}`;
                        } else {
                          routingText = "Grand Final Championship Match";
                        }

                        return (
                          <div key={match.id} className="glass-panel p-6 rounded-2xl border border-slate-800/80 flex flex-col justify-between hover:border-slate-700/60 transition-all duration-300 relative overflow-hidden">
                            <div>
                              {/* Header */}
                              <div className="flex items-center justify-between mb-4 border-b border-slate-800/60 pb-3">
                                <div>
                                  <h4 className="text-sm font-bold text-slate-200">
                                    {((match.team1 && !match.team2) || (!match.team1 && match.team2)) ? `${match.stage} (BYE)` : match.stage}
                                  </h4>
                                  <span className="text-[10px] text-slate-500 block mt-0.5">{routingText}</span>
                                </div>
                                {/* Status badge */}
                                {match.status === 'Live' && (
                                  <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    LIVE
                                  </span>
                                )}
                                {match.status === 'Completed' && (
                                  <span className="flex items-center gap-1 text-[9px] font-bold text-violet-400 uppercase tracking-widest bg-violet-500/10 px-2.5 py-0.5 rounded-full border border-violet-500/20">
                                    <Trophy className="w-2.5 h-2.5" />
                                    COMPLETED
                                  </span>
                                )}
                                {match.status === 'Upcoming' && (
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-800/50 px-2.5 py-0.5 rounded-full border border-slate-700/30">
                                    UPCOMING
                                  </span>
                                )}
                              </div>

                              {/* Match Date and Time Edit */}
                              <div className="mb-4 bg-slate-950/20 p-3 rounded-xl border border-slate-850 space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                  Schedule Date & Time
                                </label>
                                <input
                                  type="datetime-local"
                                  value={match.match_time || ''}
                                  onChange={(e) => handleUpdateMatchTime(match.id, e.target.value)}
                                  className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-2 text-xs text-slate-250 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                                />
                              </div>

                              {/* Team Selection / Info Layout */}
                              <div className="space-y-4">
                                {/* Team 1 Selector */}
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex justify-between">
                                    <span>Team 1</span>
                                    {team1Obj && <span className="text-slate-500">{team1Obj.name}</span>}
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-center shrink-0">
                                      {team1Obj && getTeamLogo(team1Obj) ? (
                                        <img
                                          src={getTeamLogo(team1Obj)}
                                          alt={team1Obj.short_name}
                                          className="w-6 h-6 rounded object-cover"
                                        />
                                      ) : (
                                        <span className="text-xs font-bold text-slate-500">{team1Obj?.short_name || '?'}</span>
                                      )}
                                    </div>
                                    <select
                                      value={t1Val}
                                      disabled={isMatchLocked}
                                      onChange={(e) => handleDrawTeamChange(match.id, 'team1', e.target.value)}
                                      className="w-full bg-slate-950/40 border border-slate-800/60 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <option value="">-- BYE (Pass) --</option>
                                      {eligibleTeams1.map((t) => (
                                        <option key={t.id} value={t.id}>
                                          {t.name} ({t.short_name}){getTeamSelectionInfo(t.id, match.id)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                {/* VS Separator */}
                                <div className="flex items-center justify-center">
                                  <span className="text-[10px] font-extrabold text-slate-650 bg-slate-900 px-3 py-1 rounded-full border border-slate-800/80">VS</span>
                                </div>

                                {/* Team 2 Selector */}
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex justify-between">
                                    <span>Team 2</span>
                                    {team2Obj && <span className="text-slate-500">{team2Obj.name}</span>}
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-center shrink-0">
                                      {team2Obj && getTeamLogo(team2Obj) ? (
                                        <img
                                          src={getTeamLogo(team2Obj)}
                                          alt={team2Obj.short_name}
                                          className="w-6 h-6 rounded object-cover"
                                        />
                                      ) : (
                                        <span className="text-xs font-bold text-slate-500">{team2Obj?.short_name || '?'}</span>
                                      )}
                                    </div>
                                    <select
                                      value={t2Val}
                                      disabled={isMatchLocked}
                                      onChange={(e) => handleDrawTeamChange(match.id, 'team2', e.target.value)}
                                      className="w-full bg-slate-950/40 border border-slate-800/60 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <option value="">-- BYE (Pass) --</option>
                                      {eligibleTeams2.map((t) => (
                                        <option key={t.id} value={t.id}>
                                          {t.name} ({t.short_name}){getTeamSelectionInfo(t.id, match.id)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Button Action */}
                            <div className="mt-6 pt-4 border-t border-slate-800/60">
                              {isMatchLocked ? (
                                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-950/20 px-3 py-2 rounded-xl border border-slate-850">
                                  <span className="w-2 h-2 rounded-full bg-slate-600" />
                                  Match is {match.status}. Setup is locked to preserve records.
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleUpdateMatchup(match.id, t1Val, t2Val)}
                                  disabled={(t1Val === t2Val && t1Val !== '') || (!t1Val && !t2Val)}
                                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-lg transition-all duration-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  Update Matchup
                                </button>
                              )}
                              {t1Val && t2Val && t1Val === t2Val && (
                                <p className="text-[10px] text-rose-400 mt-2 text-center">
                                  Warning: A team cannot play against itself.
                                </p>
                              )}
                            </div>

                            {(match.status === 'Completed' || match.status === 'Live') && (
                              <div className="mt-4 pt-4 border-t border-slate-800/60">
                                <button
                                  onClick={() => handleDownloadMatchReport(match.id)}
                                  className="w-full flex items-center justify-center gap-2 bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow border border-slate-750 transition-all duration-300 cursor-pointer"
                                >
                                  <FileText className="w-4 h-4 text-emerald-400" />
                                  Download PDF Report
                                </button>
                              </div>
                            )}
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

      {/* -------------------- LIVE SCORING VIEW -------------------- */}
      {activeSubView === 'scorer' && (
        <>
          {/* MATCH SELECTOR */}
          {!selectedMatch && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800/80">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-500" />
                Select Match to Score
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matches.filter(m => m.status !== 'Completed').map((match) => {
                  const t1 = getTeam(match.team1);
                  const t2 = getTeam(match.team2);
                  return (
                    <button
                      key={match.id}
                      onClick={() => handleMatchSelect(match)}
                      className="flex items-center justify-between p-4 bg-slate-900/40 border border-slate-800 hover:border-emerald-500/30 hover:bg-slate-900/60 rounded-xl transition-all duration-300 text-left cursor-pointer group"
                    >
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">{match.stage}</span>
                        <span className="text-xs font-bold text-slate-200 mt-1 block">
                          {t1?.name || 'TBD'} vs {t2?.name || 'TBD'}
                        </span>
                      </div>
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        match.status === 'Live' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {match.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SQUAD SETUP VIEW */}
          {selectedMatch && innings.length === 0 && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 space-y-8">
              <div className="flex items-center justify-between border-b border-slate-800/50 pb-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{selectedMatch.stage}</span>
                  <h3 className="text-lg font-bold text-slate-200 mt-0.5">
                    {getTeam(selectedMatch.team1)?.name} vs {getTeam(selectedMatch.team2)?.name}
                  </h3>
                </div>
                <button 
                  onClick={() => setSelectedMatch(null)}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  Back
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Team 1 Squad Selection */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    {getTeam(selectedMatch.team1)?.name} Playing XI ({team1Squad.length}/11)
                  </h4>
                  <div className="h-60 overflow-y-auto border border-slate-800/50 rounded-xl p-3 space-y-1 bg-slate-950/20">
                    {getTeamPlayers(selectedMatch.team1).map(p => (
                      <label key={p.id} className="flex items-center gap-2 p-2 hover:bg-slate-900/40 rounded-lg text-xs cursor-pointer text-slate-300 select-none">
                        <input
                          type="checkbox"
                          checked={team1Squad.includes(p.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (team1Squad.length < 11) setTeam1Squad([...team1Squad, p.id]);
                            } else {
                              setTeam1Squad(team1Squad.filter(id => id !== p.id));
                            }
                          }}
                          className="rounded border-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                        <span>{formatPlayerName(p)} - <span className="text-slate-500">{p.role}</span></span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Team 2 Squad Selection */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    {getTeam(selectedMatch.team2)?.name} Playing XI ({team2Squad.length}/11)
                  </h4>
                  <div className="h-60 overflow-y-auto border border-slate-800/50 rounded-xl p-3 space-y-1 bg-slate-950/20">
                    {getTeamPlayers(selectedMatch.team2).map(p => (
                      <label key={p.id} className="flex items-center gap-2 p-2 hover:bg-slate-900/40 rounded-lg text-xs cursor-pointer text-slate-300 select-none">
                        <input
                          type="checkbox"
                          checked={team2Squad.includes(p.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (team2Squad.length < 11) setTeam2Squad([...team2Squad, p.id]);
                            } else {
                              setTeam2Squad(team2Squad.filter(id => id !== p.id));
                            }
                          }}
                          className="rounded border-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                        <span>{formatPlayerName(p)} - <span className="text-slate-500">{p.role}</span></span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Setup match rules */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800/40">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Batting First</label>
                  <select
                    value={battingFirst}
                    onChange={(e) => setBattingFirst(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300"
                  >
                    <option value="">Select Team</option>
                    <option value={selectedMatch.team1}>{getTeam(selectedMatch.team1)?.name}</option>
                    <option value={selectedMatch.team2}>{getTeam(selectedMatch.team2)?.name}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Overs Limit</label>
                  {!isCustomOvers ? (
                    <select
                      value={oversLimit}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'custom') {
                          setIsCustomOvers(true);
                        } else {
                          setOversLimit(parseInt(val));
                        }
                      }}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300"
                    >
                      {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20].map((ov) => (
                        <option key={ov} value={ov}>{ov} {ov === 1 ? 'Over' : 'Overs'}</option>
                      ))}
                      <option value="custom">Custom...</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={customOversVal}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomOversVal(val);
                          const parsed = parseInt(val);
                          if (!isNaN(parsed) && parsed > 0) {
                            setOversLimit(parsed);
                          }
                        }}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300"
                        placeholder="Overs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomOvers(false);
                          setOversLimit(5);
                        }}
                        className="px-3 py-2 bg-slate-900 border border-slate-800 hover:border-slate-750 rounded-xl text-xs text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Special Extras Rule</label>
                  <button
                    type="button"
                    onClick={async () => {
                      const newValue = !selectedMatch.special_extras;
                      const updated = await pb.collection('matches').update<Match>(selectedMatch.id, {
                        special_extras: newValue
                      });
                      setSelectedMatch(updated);
                      refreshData();
                    }}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-extrabold border transition-all cursor-pointer flex items-center justify-between ${
                      selectedMatch.special_extras
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-[10px] sm:text-xs text-left truncate mr-2">Wides = 4 Runs, No Balls = 6 Runs, counted as legal balls</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                      selectedMatch.special_extras ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {selectedMatch.special_extras ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Opening Bowler</label>
                  <select
                    value={bowlerId}
                    onChange={(e) => setBowlerId(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300"
                  >
                    <option value="">Select Bowler</option>
                    {(() => {
                      const bowlingTeamId = battingFirst === selectedMatch.team1 ? selectedMatch.team2 : selectedMatch.team1;
                      const { playing, bench } = getPlayersByGroup(bowlingTeamId || '');
                      return (
                        <>
                          {playing.length > 0 && (
                            <optgroup label="Playing XI">
                              {playing.map(p => (
                                <option key={p.id} value={p.id}>{formatPlayerName(p)}</option>
                              ))}
                            </optgroup>
                          )}
                          {bench.length > 0 && (
                            <optgroup label="Substitutes / Bench">
                              {bench.map(p => (
                                <option key={p.id} value={p.id}>{formatPlayerName(p)} (Bench)</option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      );
                    })()}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Opening Striker</label>
                  <select
                    value={strikerId}
                    onChange={(e) => setStrikerId(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300"
                  >
                    <option value="">Select Striker</option>
                    {(() => {
                      const battingTeamId = battingFirst;
                      const { playing, bench } = getPlayersByGroup(battingTeamId || '');
                      return (
                        <>
                          {playing.length > 0 && (
                            <optgroup label="Playing XI">
                              {playing.map(p => (
                                <option key={p.id} value={p.id}>{formatPlayerName(p)}</option>
                              ))}
                            </optgroup>
                          )}
                          {bench.length > 0 && (
                            <optgroup label="Substitutes / Bench">
                              {bench.map(p => (
                                <option key={p.id} value={p.id}>{formatPlayerName(p)} (Bench)</option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      );
                    })()}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Opening Non-Striker</label>
                  <select
                    value={nonStrikerId}
                    onChange={(e) => setNonStrikerId(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300"
                  >
                    <option value="">Select Non-Striker</option>
                    {(() => {
                      const battingTeamId = battingFirst;
                      const { playing, bench } = getPlayersByGroup(battingTeamId || '');
                      return (
                        <>
                          {playing.length > 0 && (
                            <optgroup label="Playing XI">
                              {playing.map(p => (
                                <option key={p.id} value={p.id}>{formatPlayerName(p)}</option>
                              ))}
                            </optgroup>
                          )}
                          {bench.length > 0 && (
                            <optgroup label="Substitutes / Bench">
                              {bench.map(p => (
                                <option key={p.id} value={p.id}>{formatPlayerName(p)} (Bench)</option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      );
                    })()}
                  </select>
                </div>
              </div>

              <button
                onClick={handleStartMatch}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 hover:from-emerald-400 hover:to-teal-400 transition-colors shadow-md shadow-emerald-500/10 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Confirm Squads & Start Live Score</span>
              </button>
            </div>
          )}

          {/* LIVE SCORING VIEW */}
          {selectedMatch && innings.length > 0 && activeInning && (
            <div className="space-y-6">
              
              {/* Header summary */}
              <div className="sticky top-2 z-30 glass-panel p-3 sm:p-4 rounded-2xl border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/90 backdrop-blur-md shadow-xl">
                <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-4">
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase flex flex-wrap items-center gap-2">
                      <span>{selectedMatch.stage}</span>
                      {innings.length === 2 && activeInning.id === innings[1].id && (() => {
                        const firstInningDeliveries = deliveries.filter(d => d.inning === innings[0].id);
                        const firstInningRuns = firstInningDeliveries.reduce((sum, d) => sum + (d.runs || 0), 0);
                        const target = firstInningRuns + 1;
                        const needed = target - totalRuns;
                        const ballsRemaining = Math.max(0, ((selectedMatch.overs_limit || 5) * 6) - legalBallsCount);
                        const oversRemainingStr = `${Math.floor(ballsRemaining / 6)}.${ballsRemaining % 6}`;
                        return (
                          <span className="text-emerald-400 font-black uppercase text-[8px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            🎯 Target: {target} {needed > 0 ? `(Need ${needed} from ${ballsRemaining}b / ${oversRemainingStr} ov)` : '(Chased!)'}
                          </span>
                        );
                      })()}
                    </span>
                    <h3 className="text-sm md:text-md font-bold text-slate-200 mt-0.5 flex items-center gap-2">
                      <span className="text-base md:text-lg font-black text-emerald-400 shrink-0 flex items-center gap-1.5">
                        {getTeam(activeInning.batting_team) && getTeamLogo(getTeam(activeInning.batting_team)) && (
                          <img src={getTeamLogo(getTeam(activeInning.batting_team))} alt="" className="w-5 h-5 rounded-md object-cover border border-slate-800" />
                        )}
                        <span>🏏 {getTeam(activeInning.batting_team)?.name}</span>
                      </span>
                      <span className="text-[10px] md:text-xs text-slate-550 font-bold uppercase">vs</span>
                      <span className="text-slate-450 text-xs md:text-sm font-semibold truncate max-w-[100px] sm:max-w-none flex items-center gap-1.5">
                        {getTeam(activeInning.bawling_team) && getTeamLogo(getTeam(activeInning.bawling_team)) && (
                          <img src={getTeamLogo(getTeam(activeInning.bawling_team))} alt="" className="w-4 h-4 rounded-md object-cover border border-slate-800" />
                        )}
                        <span>{getTeam(activeInning.bawling_team)?.name}</span>
                      </span>
                      <span className="text-base md:text-2xl font-black text-emerald-400 bg-emerald-500/15 px-2.5 py-1 rounded-xl border border-emerald-500/20 shrink-0 ml-2 shadow-lg shadow-emerald-500/5">
                        {totalRuns}/{totalWickets}
                      </span>
                    </h3>
                  </div>

                  {/* Mobile over progress: show inline on mobile, hide on sm+ */}
                  <div className="sm:hidden text-right">
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">Overs</span>
                    <span className="text-sm font-black text-emerald-400">
                      {Math.floor(legalBallsCount / 6)}.{legalBallsCount % 6} / {oversLimit}
                    </span>
                  </div>
                </div>

                {/* Larger Over & Ball display - hidden on mobile, visible on sm+ */}
                <div className="hidden sm:block text-center py-2 px-5 bg-slate-950/60 border border-slate-900 rounded-xl shrink-0">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Overs Progress</span>
                  <div className="text-sm md:text-base font-black text-emerald-400 mt-0.5">
                    {Math.floor(legalBallsCount / 6)}.{legalBallsCount % 6} / {oversLimit} Overs
                  </div>
                  <span className="text-[9px] text-slate-400 font-semibold mt-0.5 block">
                    Ball {(legalBallsCount % 6) + 1} of current over
                  </span>
                </div>
                
                {/* Buttons: Undo, Exit */}
                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-2.5 sm:pt-0 border-t border-slate-800/40 sm:border-0">
                  {/* Mobile ball indicator */}
                  <span className="sm:hidden text-[10px] text-slate-450 font-medium">
                    Ball {(legalBallsCount % 6) + 1} of over
                  </span>

                  <div className="flex gap-2">
                    <button 
                      onClick={async () => {
                        const newValue = !selectedMatch.special_extras;
                        const updated = await pb.collection('matches').update<Match>(selectedMatch.id, {
                          special_extras: newValue
                        });
                        setSelectedMatch(updated);
                        refreshData();
                      }}
                      className={`px-2.5 py-1.5 border rounded-lg text-[10px] md:text-[11px] font-bold transition-all cursor-pointer ${
                        selectedMatch.special_extras
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/45 hover:bg-amber-500/30'
                          : 'bg-slate-950/40 text-slate-450 border-slate-800 hover:border-slate-700'
                      }`}
                      title="Toggle rule: Wides (4 runs) & No Balls (6 runs) count as legal deliveries"
                    >
                      Special Extras: {selectedMatch.special_extras ? 'ON' : 'OFF'}
                    </button>
                    <button 
                      onClick={undoLastBall}
                      disabled={inningDeliveries.length === 0}
                      className="px-2.5 py-1.5 border border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/80 disabled:opacity-40 disabled:cursor-not-allowed text-[10px] md:text-[11px] font-bold text-slate-400 hover:text-slate-350 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Undo
                    </button>
                    <button 
                      onClick={() => setSelectedMatch(null)}
                      className="px-2.5 py-1.5 border border-slate-800 hover:border-slate-700 text-[10px] md:text-[11px] font-bold text-slate-400 hover:text-slate-350 rounded-lg transition-colors cursor-pointer"
                    >
                      Exit
                    </button>
                  </div>
                </div>
              </div>

              {/* Match Delay Configuration Panel */}
              <div className="glass-panel p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg border ${selectedMatch.delay_reason ? 'bg-amber-500/10 border-amber-500/30 text-amber-450 animate-pulse' : 'bg-slate-950/60 border-slate-850 text-slate-500'}`}>
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-350">Play Suspension & Delay Status</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {selectedMatch.delay_reason 
                          ? `Currently suspended: "${selectedMatch.delay_reason}"` 
                          : 'Play is active. No delay recorded.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                    <select
                      value={delayPreset}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDelayPreset(val);
                        if (val === 'None') {
                          handleUpdateDelay('');
                        } else if (val === 'Rain') {
                          handleUpdateDelay('Match delayed due to rain 🌧️');
                        } else if (val === 'Bad Light') {
                          handleUpdateDelay('Match delayed due to bad light ⛅');
                        } else if (val === 'Wet Outfield') {
                          handleUpdateDelay('Match delayed due to wet outfield 💧');
                        } else if (val === 'Technical') {
                          handleUpdateDelay('Match delayed due to technical issue ⚙️');
                        }
                      }}
                      className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="None">Active Play (No Delay)</option>
                      <option value="Rain">Delayed: Rain 🌧️</option>
                      <option value="Bad Light">Delayed: Bad Light ⛅</option>
                      <option value="Wet Outfield">Delayed: Wet Outfield 💧</option>
                      <option value="Technical">Delayed: Technical Issue ⚙️</option>
                      <option value="Other">Other / Custom Reason</option>
                    </select>

                    {delayPreset === 'Other' && (
                      <div className="flex items-center gap-1.5 w-full sm:w-auto mt-2 sm:mt-0">
                        <input
                          type="text"
                          placeholder="Enter custom delay reason..."
                          value={customDelay}
                          onChange={(e) => setCustomDelay(e.target.value)}
                          className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-amber-500/50 w-full sm:w-48"
                        />
                        <button
                          onClick={() => handleUpdateDelay(customDelay)}
                          disabled={!customDelay.trim()}
                          className="px-3 py-1.5 bg-amber-550 hover:bg-amber-450 disabled:opacity-40 disabled:hover:bg-amber-550 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          Save
                        </button>
                      </div>
                    )}

                    <button
                      onClick={handleRescheduleMatch}
                      className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 text-rose-400 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reschedule Match</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Batter & Bowler selectors */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Striker Select */}
                <div className="glass-panel p-4 rounded-xl border border-slate-800/80">
                  <label className="block text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-fast" />
                    Striker (Facing)
                  </label>
                  <select
                    value={strikerId}
                    onChange={(e) => setStrikerId(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl py-2 px-3 text-xs text-slate-300"
                  >
                    <option value="">Select Striker</option>
                    {(() => {
                      const { playing, bench } = getPlayersByGroup(activeInning.batting_team);
                      const dismissedList = inningDeliveries
                        .filter(d => d.is_wicket && d.out_player && d.dismissal_type !== 'Retired Out')
                        .map(d => d.out_player);
                      const filteredPlaying = playing.filter(p => p.id !== nonStrikerId && !dismissedList.includes(p.id));
                      const filteredBench = bench.filter(p => p.id !== nonStrikerId && !dismissedList.includes(p.id));
                      return (
                        <>
                          {filteredPlaying.length > 0 && (
                            <optgroup label="Playing XI">
                              {filteredPlaying.map(p => (
                                <option key={p.id} value={p.id}>{formatPlayerName(p)}</option>
                              ))}
                            </optgroup>
                          )}
                          {filteredBench.length > 0 && (
                            <optgroup label="Substitutes / Bench">
                              {filteredBench.map(p => (
                                <option key={p.id} value={p.id}>{formatPlayerName(p)} (Bench)</option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      );
                    })()}
                  </select>
                </div>

                {/* Non-Striker Select */}
                <div className="glass-panel p-4 rounded-xl border border-slate-800/80">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Non-Striker (Crease)
                  </label>
                  <select
                    value={nonStrikerId}
                    onChange={(e) => setNonStrikerId(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl py-2 px-3 text-xs text-slate-300"
                  >
                    <option value="">Select Non-Striker</option>
                    {(() => {
                      const { playing, bench } = getPlayersByGroup(activeInning.batting_team);
                      const dismissedList = inningDeliveries
                        .filter(d => d.is_wicket && d.out_player && d.dismissal_type !== 'Retired Out')
                        .map(d => d.out_player);
                      const filteredPlaying = playing.filter(p => p.id !== strikerId && !dismissedList.includes(p.id));
                      const filteredBench = bench.filter(p => p.id !== strikerId && !dismissedList.includes(p.id));
                      return (
                        <>
                          {filteredPlaying.length > 0 && (
                            <optgroup label="Playing XI">
                              {filteredPlaying.map(p => (
                                <option key={p.id} value={p.id}>{formatPlayerName(p)}</option>
                              ))}
                            </optgroup>
                          )}
                          {filteredBench.length > 0 && (
                            <optgroup label="Substitutes / Bench">
                              {filteredBench.map(p => (
                                <option key={p.id} value={p.id}>{formatPlayerName(p)} (Bench)</option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      );
                    })()}
                  </select>
                </div>

                {/* Bowler Select */}
                <div className="glass-panel p-4 rounded-xl border border-slate-800/80">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Disc className="w-3.5 h-3.5 text-slate-500" />
                    Current Bowler (No Consecutive Overs)
                  </label>
                  <select
                    value={bowlerId}
                    onChange={(e) => setBowlerId(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl py-2 px-3 text-xs text-slate-300"
                  >
                    <option value="">Select Bowler</option>
                    {(() => {
                      const { playing, bench } = getPlayersByGroup(activeInning.bawling_team);
                      const filteredPlaying = playing;
                      const filteredBench = bench;
                      return (
                        <>
                          {filteredPlaying.length > 0 && (
                            <optgroup label="Playing XI">
                              {filteredPlaying.map(p => {
                                const balls = getBowlerBalls(p.id);
                                const isLimit = isBowlerDisabled(p.id);
                                return (
                                  <option key={p.id} value={p.id} disabled={isLimit}>
                                    {formatPlayerName(p)} ({Math.floor(balls/6)}.{balls%6} ov) {isLimit ? '[CANNOT BOWL CONSECUTIVE OVERS]' : ''}
                                  </option>
                                );
                              })}
                            </optgroup>
                          )}
                          {filteredBench.length > 0 && (
                            <optgroup label="Substitutes / Bench">
                              {filteredBench.map(p => {
                                const balls = getBowlerBalls(p.id);
                                const isLimit = isBowlerDisabled(p.id);
                                return (
                                  <option key={p.id} value={p.id} disabled={isLimit}>
                                    {formatPlayerName(p)} ({Math.floor(balls/6)}.{balls%6} ov) {isLimit ? '[CANNOT BOWL CONSECUTIVE OVERS]' : ''} (Bench)
                                  </option>
                                );
                              })}
                            </optgroup>
                          )}
                        </>
                      );
                    })()}
                  </select>
                </div>

              </div>

              {/* Squads Management (Checkboxes to change Playing XI during match) */}
              <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
                <details className="group">
                  <summary className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer select-none group-open:border-b group-open:border-slate-800 group-open:pb-3">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-emerald-400" />
                      Manage Playing XI / Squads (Exclude/Include players)
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal">Click to expand</span>
                  </summary>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    {/* Batting Team Squad */}
                    <div>
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        {getTeam(activeInning.batting_team)?.name} Playing XI ({activeBattingSquad.length})
                      </h5>
                      <div className="max-h-48 overflow-y-auto border border-slate-850/80 rounded-xl p-3 bg-slate-950/20 space-y-1">
                        {getTeamPlayers(activeInning.batting_team).map(p => {
                          const isSelected = activeBattingSquad.includes(p.id);
                          return (
                            <label key={p.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-900/30 rounded text-xs cursor-pointer text-slate-300 select-none">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (activeInning.batting_team === selectedMatch.team1) {
                                    if (e.target.checked) {
                                      setTeam1Squad([...team1Squad, p.id]);
                                    } else {
                                      setTeam1Squad(team1Squad.filter(id => id !== p.id));
                                    }
                                  } else {
                                    if (e.target.checked) {
                                      setTeam2Squad([...team2Squad, p.id]);
                                    } else {
                                      setTeam2Squad(team2Squad.filter(id => id !== p.id));
                                    }
                                  }
                                }}
                                className="rounded border-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                              />
                              <span className={isSelected ? 'font-semibold text-emerald-400' : ''}>
                                {formatPlayerName(p)} <span className="text-[10px] text-slate-500">({p.role})</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bowling Team Squad */}
                    <div>
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        {getTeam(activeInning.bawling_team)?.name} Playing XI ({activeBowlingSquad.length})
                      </h5>
                      <div className="max-h-48 overflow-y-auto border border-slate-850/80 rounded-xl p-3 bg-slate-950/20 space-y-1">
                        {getTeamPlayers(activeInning.bawling_team).map(p => {
                          const isSelected = activeBowlingSquad.includes(p.id);
                          return (
                            <label key={p.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-900/30 rounded text-xs cursor-pointer text-slate-300 select-none">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (activeInning.bawling_team === selectedMatch.team1) {
                                    if (e.target.checked) {
                                      setTeam1Squad([...team1Squad, p.id]);
                                    } else {
                                      setTeam1Squad(team1Squad.filter(id => id !== p.id));
                                    }
                                  } else {
                                    if (e.target.checked) {
                                      setTeam2Squad([...team2Squad, p.id]);
                                    } else {
                                      setTeam2Squad(team2Squad.filter(id => id !== p.id));
                                    }
                                  }
                                }}
                                className="rounded border-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                              />
                              <span className={isSelected ? 'font-semibold text-emerald-400' : ''}>
                                {formatPlayerName(p)} <span className="text-[10px] text-slate-500">({p.role})</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </details>
              </div>

              {/* Runs Input Board */}
              <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 space-y-6">
                {/* Recent Balls Ticker (Phase 2 Upgrade!) */}
                {activeInning && inningDeliveries.length > 0 && (() => {
                  let isComplete = selectedMatch.status === 'Completed' || totalWickets >= maxWickets || legalBallsCount >= oversLimit * 6;
                  if (innings.length === 2 && activeInning.id === innings[1].id) {
                    const firstInningDeliveries = deliveries.filter(d => d.inning === innings[0].id);
                    const firstInningRuns = firstInningDeliveries.reduce((sum, d) => sum + (d.runs || 0), 0);
                    if (totalRuns > firstInningRuns) {
                      isComplete = true;
                    }
                  }
                  const tickerItems = getRecentBallsTicker(inningDeliveries, isComplete);
                  return (
                    <div className="pb-4 border-b border-slate-800/40 space-y-2">
                      <span className="text-[9px] text-slate-550 font-extrabold uppercase tracking-wider block">Recent Deliveries:</span>
                      <DragScrollContainer>
                        {tickerItems.map((item) => {
                          if (item.type === 'over-divider') {
                            return (
                              <div key={item.id} className="flex flex-col items-center justify-center px-3 border-l border-r border-slate-805 shrink-0">
                                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider leading-none">{item.label}</span>
                                <span className="text-[9px] text-emerald-450 font-black uppercase mt-0.5 leading-none">{item.overRuns} R</span>
                              </div>
                            );
                          }
                          return (
                            <div key={item.id} className={`w-6.5 h-6.5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${item.badgeClass}`}>
                              {item.label}
                            </div>
                          );
                        })}
                      </DragScrollContainer>
                    </div>
                  );
                })()}

                {isTargetChased && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-4 py-3 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse mb-6">
                    <span className="flex items-center gap-1.5">
                      🏆 Target Chased! Inning is complete. To edit the final ball, click Undo.
                    </span>
                    <button 
                      onClick={undoLastBall}
                      className="w-full sm:w-auto px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg font-black uppercase text-[10px] transition-colors cursor-pointer text-center"
                    >
                      Undo Last Ball
                    </button>
                  </div>
                )}

                {!isTargetChased && isOversLimitMet && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 px-4 py-3 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse mb-6">
                    <span className="flex items-center gap-1.5">
                      ⚠️ Overs Limit Reached! Inning is complete. Please declare or switch innings. To edit, click Undo.
                    </span>
                    <button 
                      onClick={undoLastBall}
                      className="w-full sm:w-auto px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-black uppercase text-[10px] transition-colors cursor-pointer text-center"
                    >
                      Undo Last Ball
                    </button>
                  </div>
                )}

                {!isTargetChased && !isOversLimitMet && isAllOut && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-rose-350 px-4 py-3 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse mb-6">
                    <span className="flex items-center gap-1.5">
                      ⚠️ All Out! Inning is complete. Please declare or switch innings. To edit, click Undo.
                    </span>
                    <button 
                      onClick={undoLastBall}
                      className="w-full sm:w-auto px-3 py-1.5 bg-rose-500 hover:bg-rose-450 text-white rounded-lg font-black uppercase text-[10px] transition-colors cursor-pointer text-center"
                    >
                      Undo Last Ball
                    </button>
                  </div>
                )}

                {!isTargetChased && !isOversLimitMet && !isAllOut && !isPlayerSelectionValid && (
                  <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 mb-6">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      <strong>Player Selection Required:</strong> Please select <strong>Striker</strong> &amp; <strong>Non-Striker</strong> from {getTeam(activeInning.batting_team)?.short_name || 'Batting Team'} and a <strong>Bowler</strong> from {getTeam(activeInning.bawling_team)?.short_name || 'Bowling Team'} to enable scoring.
                    </span>
                  </div>
                )}

                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Record Score</span>
                  <h4 className="text-sm font-extrabold text-slate-300 mt-1">Runs scored off bat (legal ball):</h4>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-3">
                    {[0, 1, 2, 3, 4, 6].map((run) => (
                      <button
                        key={run}
                        onClick={() => recordBall(run)}
                        disabled={isScoringLocked}
                        className="py-4 bg-slate-950/40 hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-slate-800 text-sm font-extrabold text-slate-200 rounded-xl cursor-pointer shadow-sm active:scale-95 transition-all disabled:opacity-40 disabled:hover:bg-slate-950/40 disabled:hover:border-slate-800 disabled:cursor-not-allowed"
                      >
                        {run} {run === 1 ? 'Run' : 'Runs'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/40 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Extras buttons */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Extras & Runs</h4>
                    <div className="mt-3 bg-slate-950/40 border border-slate-850 rounded-xl p-4 space-y-4">
                      {/* Extra Type tabs */}
                      <div className="w-full flex gap-1.5 bg-slate-900/50 p-1 rounded-lg border border-slate-850/60 overflow-x-auto scrollbar-none shrink-0">
                        {(['Wide', 'No Ball', 'Bye', 'Leg Bye'] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              setSelectedExtra(type);
                              // Reset runs run to a sensible default
                              if (type === 'Bye' || type === 'Leg Bye') {
                                setExtraRuns(1);
                              } else {
                                setExtraRuns(0);
                              }
                            }}
                            disabled={isScoringLocked}
                            className={`flex-1 min-w-[70px] shrink-0 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                              selectedExtra === type
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'text-slate-400 hover:text-slate-200'
                            } disabled:opacity-30 disabled:pointer-events-none`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>

                      {/* Additional Runs Run */}
                      <div>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
                          {selectedExtra === 'Wide'
                            ? 'Completed Runs Run by Batters (Byes):' 
                            : (selectedExtra === 'No Ball'
                              ? 'Completed Runs Run by Batters:' 
                              : 'Runs Run (Byes/Leg Byes):')}
                        </span>
                        <div className="flex gap-1.5">
                          {(selectedExtra === 'Wide' || selectedExtra === 'No Ball' ? [0, 1, 2, 3, 4, 6] : [1, 2, 3, 4]).map((run) => (
                            <button
                              key={run}
                              type="button"
                              onClick={() => setExtraRuns(run)}
                              disabled={isScoringLocked}
                              className={`flex-1 py-2 rounded-lg text-xs font-black border transition-all cursor-pointer ${
                                extraRuns === run
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                  : 'bg-slate-900/20 border-slate-850 text-slate-400 hover:text-slate-200'
                              } disabled:opacity-30 disabled:pointer-events-none`}
                            >
                              {run}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* No Ball Runs Type Selection */}
                      {selectedExtra === 'No Ball' && extraRuns > 0 && (
                        <div>
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
                            No Ball Runs Scored Type:
                          </span>
                          <div className="flex gap-1.5">
                            {(['Off Bat', 'Byes'] as const).map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setNoBallRunsType(type)}
                                disabled={isScoringLocked}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                  noBallRunsType === type
                                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                    : 'bg-slate-900/20 border-slate-850 text-slate-400 hover:text-slate-200'
                                } disabled:opacity-30 disabled:pointer-events-none`}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Special extras extra ball toggle for final over / target defense */}
                      {selectedMatch.special_extras && (selectedExtra === 'Wide' || selectedExtra === 'No Ball') && (
                        <label className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl cursor-pointer select-none mb-3">
                          <input 
                            type="checkbox" 
                            checked={forceExtraBall} 
                            onChange={(e) => setForceExtraBall(e.target.checked)}
                            className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-bold text-amber-300 block">Re-bowl Extra Ball (Target Defense / Final Over Rule)</span>
                            <span className="text-[9px] text-amber-400/80 block">Check this to require bowler to bowl an extra ball for this delivery</span>
                          </div>
                        </label>
                      )}

                      {/* Submit extra ball */}
                      <button
                        onClick={() => {
                          let total = extraRuns;
                          let runsOffBat = 0;
                          if (selectedExtra === 'Wide' || selectedExtra === 'No Ball') {
                            if (selectedMatch.special_extras) {
                              total = selectedExtra === 'Wide' ? 4 + extraRuns : 6 + extraRuns;
                            } else {
                              total = 1 + extraRuns;
                            }
                            if (selectedExtra === 'No Ball' && noBallRunsType === 'Off Bat') {
                              runsOffBat = extraRuns;
                            }
                          }
                          recordBall(total, true, selectedExtra, runsOffBat, forceExtraBall);
                        }}
                        disabled={isScoringLocked}
                        className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 text-[11px] font-bold text-amber-400 uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-amber-500/10 disabled:hover:border-amber-500/20 disabled:cursor-not-allowed"
                      >
                        {selectedMatch.special_extras && selectedExtra === 'Wide' ? (
                          `Record Wide (4 Penalty + ${extraRuns} Byes = ${4 + extraRuns} Runs)`
                        ) : selectedMatch.special_extras && selectedExtra === 'No Ball' ? (
                          `Record No Ball (6 Penalty + ${extraRuns} ${noBallRunsType === 'Off Bat' ? 'Bat' : 'Byes'} = ${6 + extraRuns} Runs)`
                        ) : (
                          <>
                            Record {selectedExtra} + {extraRuns} ({ (selectedExtra === 'Wide' || selectedExtra === 'No Ball' ? 1 + extraRuns : extraRuns) } { (selectedExtra === 'Wide' || selectedExtra === 'No Ball' ? 1 + extraRuns : extraRuns) === 1 ? 'Run' : 'Runs' } Total)
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Wickets button */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Wickets & Dismissals</h4>
                    <button
                      onClick={handleWicketClick}
                      disabled={isScoringLocked}
                      className="w-full py-8 mt-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 text-sm font-extrabold text-rose-400 rounded-xl flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all disabled:opacity-40 disabled:hover:bg-rose-500/10 disabled:hover:border-rose-500/20 disabled:cursor-not-allowed"
                    >
                      Record Wicket
                    </button>
                  </div>
                </div>
              </div>

              {/* DECLARE INNING BUTTON */}
              <div className="flex justify-end">
                <button
                  onClick={handleDeclareInning}
                  className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer shadow-md shadow-violet-500/10 animate-pulse-slow"
                >
                  {innings.length === 1 ? 'End 1st Inning / Switch' : 'Declare & End Match'}
                </button>
              </div>

              {/* CURRENT INNING SCORECARD FOR ADMIN */}
              {(() => {
                const state = getInningScorecardState();
                if (!state) return null;
                const bTeam = getTeam(activeInning.batting_team);

                return (
                  <div className="glass-panel p-6 rounded-2xl border border-slate-800/85 space-y-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b border-slate-850 pb-2 mb-3">
                      Current Inning Scorecard ({bTeam?.name})
                    </h3>

                    {/* Batting Card */}
                    <div className="overflow-x-auto w-full">
                      <table className="w-full min-w-[550px] text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-850 text-slate-500 font-bold">
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
                          {Object.entries(state.batsmanRuns).map(([bId, runs]) => {
                            const batter = players.find(p => p.id === bId);
                            const balls = state.batsmanBalls[bId] || 0;
                            const fours = state.batsmanFours[bId] || 0;
                            const sixes = state.batsmanSixes[bId] || 0;
                            const dis = state.batsmanDismissal[bId] || (bId === strikerId || bId === nonStrikerId ? 'batting' : 'not out');

                            const sr = balls === 0 ? '0.00' : ((runs / balls) * 100).toFixed(2);

                            return (
                              <tr key={bId} className="border-b border-slate-900/40 hover:bg-slate-950/10">
                                <td className="py-2.5 font-bold text-slate-200">{batter?.name}</td>
                                <td className={`py-2.5 text-xs ${dis === 'batting' ? 'text-emerald-400 font-semibold' : dis === 'not out' ? 'text-emerald-500/85' : 'text-slate-500'}`}>
                                  {dis}
                                </td>
                                <td className="py-2.5 text-right font-extrabold text-slate-200">{runs}</td>
                                <td className="py-2.5 text-right text-slate-400">{balls}</td>
                                <td className="py-2.5 text-right text-slate-400">{fours}</td>
                                <td className="py-2.5 text-right text-slate-400">{sixes}</td>
                                <td className="py-2.5 text-right text-slate-500">{sr}</td>
                              </tr>
                            );
                          })}
                          
                          {/* Extras row */}
                          <tr className="border-t border-slate-850 text-slate-400 bg-slate-950/15">
                            <td className="py-2.5 font-semibold">Extras</td>
                            <td colSpan={6} className="py-2.5 text-left pl-4 font-semibold text-slate-350">
                              {state.totalExtras} <span className="text-slate-500 text-[10px] font-normal ml-1.5">(wd {state.extrasWides}, nb {state.extrasNoBalls}, b {state.extrasByes}, lb {state.extrasLegByes})</span>
                            </td>
                          </tr>

                          {/* Total row */}
                          <tr className="border-t border-slate-800 font-bold bg-slate-950/25">
                            <td className="py-3 text-slate-200">Total</td>
                            <td colSpan={6} className="py-3 text-left pl-4 text-emerald-450 font-extrabold text-sm">
                              {state.totalRuns}/{state.totalWickets} <span className="text-slate-500 text-xs font-semibold ml-1.5">({state.oversStr} Ov)</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Bowling Card */}
                    <div className="overflow-x-auto w-full pt-4 border-t border-slate-850">
                      <table className="w-full min-w-[500px] text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-850 text-slate-500 font-bold">
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
                            const bowler = players.find(p => p.id === bowlerId);
                            const runs = state.bowlerRuns[bowlerId] || 0;
                            const wickets = state.bowlerWickets[bowlerId] || 0;
                            const wides = state.bowlerWides[bowlerId] || 0;
                            const noBalls = state.bowlerNoBalls[bowlerId] || 0;

                            const econ = balls === 0 ? '0.00' : (runs / (balls / 6)).toFixed(2);

                            return (
                              <tr key={bowlerId} className="border-b border-slate-900/40 hover:bg-slate-950/10">
                                <td className="py-2.5 font-bold text-slate-200">{bowler?.name}</td>
                                <td className="py-2.5 text-right text-slate-350 font-medium">
                                  {Math.floor(balls / 6)}.{balls % 6}
                                </td>
                                <td className="py-2.5 text-right text-slate-300">{runs}</td>
                                <td className="py-2.5 text-right font-extrabold text-emerald-400">{wickets}</td>
                                <td className="py-2.5 text-right text-slate-400">{wides}</td>
                                <td className="py-2.5 text-right text-slate-400">{noBalls}</td>
                                <td className="py-2.5 text-right text-slate-500">{econ}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Ball by Ball Commentary (Phase 2 Upgrade!) */}
                    <div className="pt-4 border-t border-slate-850">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 pb-2 mb-3">
                        Live Commentary Log
                      </h4>
                      <div className="max-h-48 overflow-y-auto pr-1 space-y-2 bg-slate-950/45 border border-slate-900/60 p-3 rounded-xl scrollbar-thin scrollbar-thumb-slate-800/80">
                        {inningDeliveries.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-500 italic">No deliveries recorded in this inning yet.</div>
                        ) : (
                          [...inningDeliveries].reverse().map((d) => (
                            <div key={d.id} className="flex items-start gap-2.5 text-xs py-1.5 border-b border-slate-900/30 hover:bg-slate-950/10 transition-colors">
                              <span className="font-extrabold text-slate-450 min-w-[28px] text-right shrink-0 bg-slate-950/45 px-1 py-0.5 rounded border border-slate-850">
                                {d.over_number}.{d.ball_number}
                              </span>
                              <div className="flex-1 text-slate-350">
                                <span className="font-bold text-slate-200">{formatPlayerName(d.striker) || 'Striker'}</span>
                                <span className="text-slate-550 mx-1">faced</span>
                                <span className="font-bold text-slate-200">{formatPlayerName(d.bawler) || 'Bowler'}</span>
                                <span className="text-slate-400 font-medium font-sans"> - {renderCommentaryText(d)}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${
                                d.is_wicket 
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

            </div>
          )}
        </>
      )}

      {/* -------------------- NEWS ROOM MANAGER VIEW -------------------- */}
      {activeSubView === 'news' && (
        <div className="space-y-10 animate-fade-in">
          {/* Post News Article Form */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Upload className="w-4.5 h-4.5 text-emerald-450" />
              Post New News Article
            </h3>
            <form onSubmit={handlePostNews} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-450 uppercase mb-2">Headline</label>
                <input
                  type="text"
                  placeholder="Enter a catchy headline..."
                  value={newsHeadline}
                  onChange={(e) => setNewsHeadline(e.target.value)}
                  required
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40 placeholder:text-slate-650"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-450 uppercase mb-2">Description / Body Text</label>
                <textarea
                  placeholder="Write the details here..."
                  value={newsDescription}
                  onChange={(e) => setNewsDescription(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40 placeholder:text-slate-650 resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-450 uppercase mb-2">Photos (Single or Multiple)</label>
                <input
                  id="news-photos-input"
                  type="file"
                  multiple
                  accept="image/*"
                  className="w-full bg-slate-950/40 border border-slate-800/60 text-slate-400 py-1.5 px-3 rounded-xl text-xs cursor-pointer focus:outline-none file:bg-slate-800 file:border-0 file:rounded file:text-xs file:font-semibold file:text-slate-300 file:px-2.5 file:py-1 file:mr-2 file:cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 mt-1">Select one photo for static display, or multiple photos to generate a slideshow.</p>
              </div>

              <button
                type="submit"
                disabled={isPostingNews}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {isPostingNews ? 'Posting Article...' : 'Post News Article'}
              </button>
            </form>
          </div>

          {/* Manage Existing News Articles */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800/80">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Trash2 className="w-4.5 h-4.5 text-rose-450" />
              Manage News Articles
            </h3>

            {news.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No news articles have been posted yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {news.map((item) => (
                  <div key={item.id} className="py-4 flex items-start justify-between gap-4 first:pt-0 last:pb-0">
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-tight">{item.headline}</h4>
                      <p className="text-[10px] text-slate-500 flex items-center gap-2">
                        <span>Posted on: {item.created ? new Date(item.created).toLocaleDateString() : 'Unknown'}</span>
                        <span>•</span>
                        <span>{item.photos?.length || 0} photo(s)</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleStartEditNews(item)}
                        className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/30 rounded-lg transition-colors cursor-pointer"
                        title="Edit Article"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteNews(item.id)}
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/30 rounded-lg transition-colors cursor-pointer"
                        title="Delete Article"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* WICKET MODAL */}
      {showWicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overflow-x-hidden">
          <div className="w-full max-w-[calc(100vw-32px)] sm:max-w-md bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-rose-400 uppercase tracking-widest">Select Wicket Details</h3>
              <button 
                onClick={() => setShowWicketModal(false)}
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Dismissal Type</label>
                <select
                  value={dismissalType}
                  onChange={(e) => setDismissalType(e.target.value as any)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300"
                >
                  <option value="Bawled">Bowled</option>
                  <option value="Catch">Caught</option>
                  <option value="Run Out">Run Out</option>
                  <option value="Stumped">Stumped</option>
                  <option value="Hit Wicket">Hit Wicket</option>
                  <option value="Retired Out">Retired Out</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Out Player</label>
                <select
                  value={outPlayerId}
                  onChange={(e) => setOutPlayerId(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300"
                >
                  <option value="">Select Out Player</option>
                  {strikerId && <option value={strikerId}>{formatPlayerName(strikerId)} (Striker)</option>}
                  {nonStrikerId && <option value={nonStrikerId}>{formatPlayerName(nonStrikerId)} (Non-Striker)</option>}
                </select>
              </div>

              {/* Fielder Select - required if Catch or Run Out */}
              {(dismissalType === 'Catch' || dismissalType === 'Run Out') && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                    Fielder Involved
                  </label>
                  <select
                    value={fielderId}
                    onChange={(e) => setFielderId(e.target.value)}
                    required
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300"
                  >
                    <option value="">Select Fielder</option>
                    {activeInning && players.filter(p => p.team === activeInning.bawling_team).map(p => (
                      <option key={p.id} value={p.id}>{formatPlayerName(p)}</option>
                    ))}
                  </select>
                </div>
              )}

              {dismissalType === 'Run Out' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                      Completed Runs before Run Out
                    </label>
                    <select
                      value={runoutCompletedRuns}
                      onChange={(e) => setRunoutCompletedRuns(parseInt(e.target.value))}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300"
                    >
                      <option value="0">0 Runs</option>
                      <option value="1">1 Run</option>
                      <option value="2">2 Runs</option>
                      <option value="3">3 Runs</option>
                      <option value="4">4 Runs</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                      Delivery Extra Type
                    </label>
                    <select
                      value={runoutExtraType}
                      onChange={(e) => setRunoutExtraType(e.target.value as any)}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300"
                    >
                      <option value="None">None (Runs off bat)</option>
                      <option value="Wide">Wide</option>
                      <option value="No Ball">No Ball</option>
                      <option value="Bye">Bye</option>
                      <option value="Leg Bye">Leg Bye</option>
                    </select>
                  </div>

                  {runoutExtraType === 'No Ball' && runoutCompletedRuns > 0 && (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                        No Ball Runs Type
                      </label>
                      <div className="flex gap-2">
                        {(['Off Bat', 'Byes'] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setRunoutNoBallType(type)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              runoutNoBallType === type
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : 'bg-slate-900/20 border-slate-850 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {type === 'Off Bat' ? 'Off Bat' : 'Byes'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <button
              onClick={recordWicket}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-red-600 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl hover:from-rose-400 hover:to-red-500 transition-colors shadow-md shadow-rose-500/10 cursor-pointer"
            >
              Submit Wicket Delivery
            </button>
          </div>
        </div>
      )}

      {/* EDIT TEAM MODAL */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overflow-x-hidden">
          <div className="w-full max-w-[calc(100vw-32px)] sm:max-w-md bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-slate-200 uppercase tracking-widest">Edit Team Details</h3>
              <button onClick={() => setEditingTeam(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Team Name</label>
                <input
                  type="text"
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  required
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Short Name (Max 8 Letters)</label>
                <input
                  type="text"
                  maxLength={8}
                  value={editTeamShortName}
                  onChange={(e) => setEditTeamShortName(e.target.value.toUpperCase())}
                  required
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Team Captain</label>
                <select
                  value={editTeamCaptainId}
                  onChange={(e) => setEditTeamCaptainId(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/40"
                >
                  <option value="">-- No Captain Selected --</option>
                  {players.filter(p => p.team === editingTeam.id).map(p => (
                    <option key={p.id} value={p.id}>{formatPlayerName(p)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Update Logo (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditTeamLogo(e.target.files?.[0] || null)}
                  className="w-full bg-slate-950/40 border border-slate-800/60 text-slate-400 py-1.5 px-3 rounded-xl text-xs cursor-pointer focus:outline-none file:bg-slate-800 file:border-0 file:rounded file:text-xs file:font-semibold file:text-slate-300 file:px-2.5 file:py-1 file:mr-2 file:cursor-pointer"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-colors shadow-md cursor-pointer"
              >
                Save Updates
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PLAYER MODAL */}
      {editingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overflow-x-hidden">
          <div className="w-full max-w-[calc(100vw-32px)] sm:max-w-md bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-slate-200 uppercase tracking-widest">Edit Player Details</h3>
              <button onClick={() => setEditingPlayer(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditPlayer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Player Name</label>
                <input
                  type="text"
                  value={editPlayerName}
                  onChange={(e) => setEditPlayerName(e.target.value)}
                  required
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Player Number (Optional)</label>
                <input
                  type="text"
                  value={editPlayerEpf}
                  onChange={(e) => setEditPlayerEpf(e.target.value.replace(/[^0-9]/g, '').substring(0, 5))}
                  maxLength={5}
                  placeholder="e.g. 12345"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Select Team</label>
                  <select
                    value={editPlayerTeamId}
                    onChange={(e) => setEditPlayerTeamId(e.target.value)}
                    required
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300"
                  >
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Player Role</label>
                  <select
                    value={editPlayerRole}
                    onChange={(e) => setEditPlayerRole(e.target.value as any)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300"
                  >
                    <option value="Batter">Batter</option>
                    <option value="Bawler">Bowler</option>
                    <option value="All-Rounder">All-Rounder</option>
                    <option value="Wicket Keeper">Wicket Keeper</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Update Photo (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditPlayerPhoto(e.target.files?.[0] || null)}
                  className="w-full bg-slate-950/40 border border-slate-800/60 text-slate-400 py-1.5 px-3 rounded-xl text-xs cursor-pointer focus:outline-none file:bg-slate-800 file:border-0 file:rounded file:text-xs file:font-semibold file:text-slate-300 file:px-2.5 file:py-1 file:mr-2 file:cursor-pointer"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-colors shadow-md cursor-pointer"
              >
                Save Updates
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT NEWS MODAL */}
      {editingNews && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overflow-x-hidden">
          <div className="w-full max-w-[calc(100vw-32px)] sm:max-w-lg bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto relative overflow-hidden font-sans">
            {/* Subtle premium background glow */}
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl pointer-events-none bg-emerald-500/5" />
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-slate-200 uppercase tracking-widest">Edit News Article</h3>
              <button 
                onClick={() => setEditingNews(null)} 
                className="text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleEditNewsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Headline</label>
                <input
                  type="text"
                  value={editNewsHeadline}
                  onChange={(e) => setEditNewsHeadline(e.target.value)}
                  required
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40"
                  placeholder="Enter headline"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Description / Body</label>
                <textarea
                  value={editNewsDescription}
                  onChange={(e) => setEditNewsDescription(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40"
                  placeholder="Enter article description..."
                />
              </div>

              {/* Photos management */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-400 uppercase">Manage Photos</label>
                
                {/* Existing Photos Grid */}
                {editNewsExistingPhotos.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Current Photos:</span>
                    <div className="grid grid-cols-3 gap-2">
                      {editNewsExistingPhotos.map((photo) => (
                        <div key={photo} className="relative aspect-video rounded-xl overflow-hidden border border-slate-800/80 bg-slate-950/40 group">
                          <img
                            src={getFileUrl('news', editingNews.id, photo)}
                            alt="News photo"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setEditNewsExistingPhotos(prev => prev.filter(p => p !== photo))}
                            className="absolute top-1 right-1 p-1 bg-rose-500/90 hover:bg-rose-600 text-slate-950 rounded-lg transition-colors shadow-md cursor-pointer flex items-center justify-center"
                            title="Remove photo"
                          >
                            <X className="w-3.5 h-3.5 font-bold" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New Photos queue */}
                {editNewsNewPhotos.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-emerald-400 uppercase font-bold">New Photos to Upload:</span>
                    <div className="grid grid-cols-3 gap-2">
                      {editNewsNewPhotos.map((file, idx) => {
                        const objectUrl = URL.createObjectURL(file);
                        return (
                          <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-emerald-500/30 bg-slate-950/40 group">
                            <img
                              src={objectUrl}
                              alt="New upload preview"
                              className="w-full h-full object-cover"
                              onLoad={() => URL.revokeObjectURL(objectUrl)}
                            />
                            <span className="absolute bottom-1 left-1 px-1 py-0.5 bg-emerald-500/95 text-[7px] text-slate-950 font-black uppercase rounded tracking-wider">New</span>
                            <button
                              type="button"
                              onClick={() => setEditNewsNewPhotos(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute top-1 right-1 p-1 bg-rose-500/90 hover:bg-rose-600 text-slate-950 rounded-lg transition-colors shadow-md cursor-pointer flex items-center justify-center"
                              title="Cancel upload"
                            >
                              <X className="w-3.5 h-3.5 font-bold" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* File input for new uploads */}
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1.5">Add More Photos:</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files) {
                        const filesArr = Array.from(e.target.files);
                        setEditNewsNewPhotos(prev => [...prev, ...filesArr]);
                        e.target.value = '';
                      }
                    }}
                    className="w-full bg-slate-950/40 border border-slate-800/60 text-slate-400 py-1.5 px-3 rounded-xl text-xs cursor-pointer focus:outline-none file:bg-slate-800 file:border-0 file:rounded file:text-xs file:font-semibold file:text-slate-300 file:px-2.5 file:py-1 file:mr-2 file:cursor-pointer"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingNews(null)}
                  className="flex-1 py-2.5 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingNews}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/10 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSavingNews ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION MODAL */}
      {showConfirmModal && confirmModalConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overflow-x-hidden">
          <div className="w-full max-w-[calc(100vw-32px)] sm:max-w-md bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-2xl space-y-5 relative overflow-hidden font-sans max-h-[90vh] overflow-y-auto">
            {/* Ambient subtle glow inside modal for wow-factor */}
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl pointer-events-none ${confirmModalConfig.isDanger ? 'bg-rose-500/10' : 'bg-emerald-500/10'}`} />
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className={`text-sm font-extrabold uppercase tracking-widest ${confirmModalConfig.isDanger ? 'text-rose-400' : 'text-emerald-400'}`}>
                {confirmModalConfig.title}
              </h3>
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed py-2">
              {confirmModalConfig.message}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={async () => {
                  setShowConfirmModal(false);
                  if (confirmModalConfig.onCancel) {
                    await confirmModalConfig.onCancel();
                  }
                }}
                className="flex-1 py-2.5 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                {confirmModalConfig.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowConfirmModal(false);
                  await confirmModalConfig.onConfirm();
                }}
                className={`flex-1 py-2.5 text-slate-950 text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer ${
                  confirmModalConfig.isDanger
                    ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 shadow-rose-950/10'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-950/10'
                }`}
              >
                {confirmModalConfig.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUPER OVER BATTING FIRST SELECTION MODAL */}
      {showSOBattingFirstSelectModal && soSelectMatch && (() => {
        const teamA = getTeam(soSelectMatch.team1);
        const teamB = getTeam(soSelectMatch.team2);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overflow-x-hidden animate-fade-in">
            <div className="w-full max-w-[calc(100vw-32px)] sm:max-w-md bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-2xl space-y-6 relative overflow-hidden font-sans">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl pointer-events-none bg-emerald-500/10" />
              
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-widest">
                  Super Over {soRoundNumToCreate} Setup
                </h3>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Select the team that will bat first in this Super Over
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {teamA && (
                  <button
                    type="button"
                    onClick={() => handleCreateSuperOverInning(teamA.id, teamB?.id || '')}
                    className="w-full p-4 bg-slate-950/40 hover:bg-slate-950 border border-slate-800/80 hover:border-emerald-500/50 rounded-xl transition-all cursor-pointer text-left flex items-center gap-3 group"
                  >
                    {getTeamLogo(teamA) && (
                      <img src={getTeamLogo(teamA)} alt="" className="w-8 h-8 rounded-lg object-contain bg-slate-900 p-1 border border-slate-800" />
                    )}
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Batting First</span>
                      <span className="text-xs font-black text-slate-200 group-hover:text-emerald-400 transition-colors">
                        {teamA.name}
                      </span>
                    </div>
                  </button>
                )}

                {teamB && (
                  <button
                    type="button"
                    onClick={() => handleCreateSuperOverInning(teamB.id, teamA?.id || '')}
                    className="w-full p-4 bg-slate-950/40 hover:bg-slate-950 border border-slate-800/80 hover:border-emerald-500/50 rounded-xl transition-all cursor-pointer text-left flex items-center gap-3 group"
                  >
                    {getTeamLogo(teamB) && (
                      <img src={getTeamLogo(teamB)} alt="" className="w-8 h-8 rounded-lg object-contain bg-slate-900 p-1 border border-slate-800" />
                    )}
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Batting First</span>
                      <span className="text-xs font-black text-slate-200 group-hover:text-emerald-400 transition-colors">
                        {teamB.name}
                      </span>
                    </div>
                  </button>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSOBattingFirstSelectModal(false);
                    setSoSelectMatch(null);
                  }}
                  className="px-4 py-2 border border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950 text-slate-450 hover:text-slate-250 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SCORER ERROR MODAL */}
      {showScorerErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overflow-x-hidden">
          <div className="w-full max-w-[calc(100vw-32px)] sm:max-w-md bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-2xl space-y-5 relative overflow-hidden font-sans max-h-[90vh] overflow-y-auto">
            {/* Ambient red glow inside modal for error warning */}
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl pointer-events-none bg-rose-500/10" />
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                <h3 className="text-sm font-extrabold uppercase tracking-widest text-rose-400">
                  Selection Required
                </h3>
              </div>
              <button 
                onClick={() => setShowScorerErrorModal(false)}
                className="text-slate-500 hover:text-slate-350 text-xs cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed py-2">
              {scorerErrorMsg}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowScorerErrorModal(false)}
                className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-rose-950/10 transition-all cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
