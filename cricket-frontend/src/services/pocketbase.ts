import PocketBase from 'pocketbase';

const getPocketBaseUrl = () => {
  if (import.meta.env.VITE_PB_URL) {
    return import.meta.env.VITE_PB_URL;
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://127.0.0.1:80';
};

export const pb = new PocketBase(getPocketBaseUrl());
pb.autoCancellation(false);

// Helper to get file URL from PocketBase storage
export const getFileUrl = (collectionName: string, recordId: string, filename: string) => {
  if (!filename) return '';
  return `${pb.baseUrl}/api/files/${collectionName}/${recordId}/${filename}`;
};

// Helper to get deterministic hash from a string
const getDeterministicHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};

// 30 distinct premium gradient color schemes
const GRADIENTS = [
  { start: '#059669', end: '#0d9488' }, // Emerald - Teal
  { start: '#7c3aed', end: '#4f46e5' }, // Violet - Indigo
  { start: '#d97706', end: '#ea580c' }, // Amber - Orange
  { start: '#e11d48', end: '#be123c' }, // Rose - Crimson
  { start: '#0891b2', end: '#0284c7' }, // Cyan - Sky
  { start: '#db2777', end: '#c026d3' }, // Pink - Fuchsia
  { start: '#ca8a04', end: '#84cc16' }, // Yellow - Lime
  { start: '#9333ea', end: '#c084fc' }, // Purple - Lavender
  { start: '#2563eb', end: '#1d4ed8' }, // Blue - Dark Blue
  { start: '#475569', end: '#334155' }, // Slate - Steel
  { start: '#dc2626', end: '#ea580c' }, // Red - Orange
  { start: '#059669', end: '#10b981' }, // Green - Bright Green
  { start: '#4f46e5', end: '#06b6d4' }, // Indigo - Cyan
  { start: '#b45309', end: '#d97706' }, // Bronze - Gold
  { start: '#ec4899', end: '#f43f5e' }, // Hot Pink - Rose
  { start: '#8b5cf6', end: '#ec4899' }, // Violet - Pink
  { start: '#06b6d4', end: '#3b82f6' }, // Cyan - Blue
  { start: '#10b981', end: '#84cc16' }, // Mint - Lime
  { start: '#f59e0b', end: '#ef4444' }, // Amber - Red
  { start: '#6366f1', end: '#a855f7' }, // Indigo - Purple
  { start: '#14b8a6', end: '#06b6d4' }, // Teal - Cyan
  { start: '#f43f5e', end: '#8b5cf6' }, // Rose - Violet
  { start: '#f59e0b', end: '#10b981' }, // Orange - Emerald
  { start: '#3b82f6', end: '#8b5cf6' }, // Blue - Violet
  { start: '#ef4444', end: '#ec4899' }, // Red - Pink
  { start: '#06b6d4', end: '#10b981' }, // Cyan - Emerald
  { start: '#8b5cf6', end: '#6366f1' }, // Violet - Indigo
  { start: '#f59e0b', end: '#ef4444' }, // Yellow - Red
  { start: '#10b981', stop: '#3b82f6', end: '#3b82f6' }, // Emerald - Blue (Wait, let's fix stop parameter: start and end)
  { start: '#64748b', end: '#475569' }  // Cool Gray - Slate
];

// Helper to generate a dynamic SVG team logo based on deterministic inputs
export const generateSVGLogo = (teamName: string, shortName: string) => {
  const hash = getDeterministicHash(teamName + shortName);
  const logoIndex = hash % 30;
  const shapeIndex = hash % 5;
  const patternIndex = hash % 6;

  const gradient = GRADIENTS[logoIndex] || GRADIENTS[0];
  
  // Shapes
  let shapePath = '';
  let isCircle = false;
  if (shapeIndex === 0) {
    shapePath = 'M50 8 L82 17 C82 53 50 80 50 92 C50 80 18 53 18 17 Z'; // Rounded Shield
  } else if (shapeIndex === 1) {
    shapePath = 'M50 8 L85 27 L85 68 L50 92 L15 68 L15 27 Z'; // Hexagon
  } else if (shapeIndex === 2) {
    isCircle = true;
  } else if (shapeIndex === 3) {
    shapePath = 'M50 8 L88 50 L50 92 L12 50 Z'; // Diamond
  } else {
    shapePath = 'M50 16 L82 10 L78 60 C78 75 50 92 50 92 C50 75 22 60 18 10 Z'; // Crown Shield
  }

  // Patterns/Overlays
  let overlaySvg = '';
  if (patternIndex === 0) {
    // Crossed bats & ball
    overlaySvg = `
      <path d="M30 70 L70 30 M33 73 L73 33" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.18" />
      <circle cx="50" cy="50" r="7" fill="#ffffff" opacity="0.22" />
    `;
  } else if (patternIndex === 1) {
    // Stars
    overlaySvg = `
      <polygon points="50,20 53,26 60,26 55,30 57,37 50,33 43,37 45,30 40,26 47,26" fill="#ffffff" opacity="0.3" />
      <polygon points="34,26 36,31 42,31 37,35 39,41 34,38 29,41 31,35 26,31 32,31" fill="#ffffff" opacity="0.18" />
      <polygon points="66,26 68,31 74,31 69,35 71,41 66,38 61,41 63,35 58,31 64,31" fill="#ffffff" opacity="0.18" />
    `;
  } else if (patternIndex === 2) {
    // Lightning
    overlaySvg = `
      <path d="M54 18 L36 50 L48 50 L44 82 L64 50 L52 50 Z" fill="#ffffff" opacity="0.2" />
    `;
  } else if (patternIndex === 3) {
    // Crown
    overlaySvg = `
      <path d="M36 28 L42 38 L50 31 L58 38 L64 28 L59 42 L41 42 Z" fill="#ffffff" opacity="0.25" />
    `;
  } else if (patternIndex === 4) {
    // Inner border line
    if (isCircle) {
      overlaySvg = `<circle cx="50" cy="50" r="36" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="4,3" opacity="0.25" />`;
    } else {
      overlaySvg = `<path d="${shapePath}" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="4,3" opacity="0.22" transform="scale(0.85) translate(8.8, 8.8)" />`;
    }
  } else {
    // Trophy
    overlaySvg = `
      <path d="M38 32 H62 V44 C62 51 57 56 50 56 C43 56 38 51 38 44 Z M50 56 V66 M44 66 H56" stroke="#ffffff" stroke-width="2.5" fill="none" opacity="0.22" stroke-linecap="round" />
    `;
  }

  // Initials Text
  const initials = (shortName || teamName.substring(0, 3)).toUpperCase().trim();
  const fontSize = initials.length > 5 ? 12 : initials.length > 3 ? 15 : 19;
  const textY = initials.length > 3 ? 54 : 56;

  const svgBg = isCircle 
    ? `<circle cx="50" cy="50" r="44" fill="url(#grad-${logoIndex}-${hash})" stroke="#ffffff" stroke-width="2" opacity="0.95" />`
    : `<path d="${shapePath}" fill="url(#grad-${logoIndex}-${hash})" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round" opacity="0.95" />`;

  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <defs>
      <linearGradient id="grad-${logoIndex}-${hash}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${gradient.start}" />
        <stop offset="100%" stop-color="${gradient.end}" />
      </linearGradient>
      <filter id="shadow-${hash}" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3" />
      </filter>
    </defs>
    <g filter="url(#shadow-${hash})">
      ${svgBg}
      ${overlaySvg}
      <text x="50%" y="${textY}%" text-anchor="middle" fill="#ffffff" font-family="'Outfit', 'Inter', sans-serif" font-weight="900" font-size="${fontSize}" letter-spacing="0.5">${initials}</text>
    </g>
  </svg>`;

  const toBase64 = (str: string) => {
    return window.btoa(unescape(encodeURIComponent(str)));
  };

  return `data:image/svg+xml;base64,${toBase64(svgString)}`;
};

// Helper to get team logo URL (with fallback to local company assets)
export const getTeamLogo = (team?: Team | null) => {
  if (!team) return '';
  if (team.logo) {
    return `${pb.baseUrl}/api/files/teams/${team.id}/${team.logo}`;
  }
  const nameLower = team.name.toLowerCase();
  if (nameLower.includes('tech titans')) return '/logos/tech_titans.png';
  if (nameLower.includes('finance falcons')) return '/logos/finance_falcons.png';
  if (nameLower.includes('marketing mavericks')) return '/logos/marketing_mavericks.png';
  if (nameLower.includes('sales sharks')) return '/logos/sales_sharks.png';
  if (nameLower.includes('hr hurricanes')) return '/logos/hr_hurricanes.png';
  if (nameLower.includes('ops olympians')) return '/logos/ops_olympians.png';
  if (nameLower.includes('product pioneers')) return '/logos/product_pioneers.png';
  if (nameLower.includes('support spartans')) return '/logos/support_spartans.png';
  
  return generateSVGLogo(team.name, team.short_name);
};

// TypeScript Interfaces for PocketBase Collections

export interface Team {
  id: string;
  name: string;
  short_name: string;
  logo: string;
  captain?: string;
  created?: string;
  updated?: string;
  expand?: {
    captain?: Player;
  };
}

export interface Player {
  id: string;
  name: string;
  role: 'Batter' | 'Bawler' | 'All-Rounder' | 'Wicket Keeper';
  team: string; // Team ID
  photo?: string; // Optional player photo filename
  epf_number?: string;
  created?: string;
  updated?: string;
  expand?: {
    team?: Team;
  };
}

export interface Match {
  id: string;
  stage: string;
  status: 'Upcoming' | 'Live' | 'Completed';
  team1: string; // Team ID or empty
  team2: string; // Team ID or empty
  winner: string; // Team ID or empty
  overs_limit?: number; // Configurable overs limit
  match_time?: string; // Scheduled date and time
  special_extras?: boolean; // Rule where Wides/No Balls count as legal balls and award 4/6 runs
  team1_squad?: string[]; // Array of Player IDs
  team2_squad?: string[]; // Array of Player IDs
  delay_reason?: string; // Rain/bad light/other delays reason
  created?: string;
  updated?: string;
  expand?: {
    team1?: Team;
    team2?: Team;
    winner?: Team;
  };
}

export interface Inning {
  id: string;
  match: string; // Match ID
  batting_team: string; // Team ID
  bawling_team: string; // Team ID
  total_runs: number;
  total_wickets: number;
  total_overs: number;
  created?: string;
  updated?: string;
  expand?: {
    match?: Match;
    batting_team?: Team;
    bawling_team?: Team;
  };
}

export interface Delivery {
  id: string;
  inning: string; // Inning ID
  striker: string; // Player ID
  bawler: string; // Player ID
  over_number: number;
  ball_number: number;
  runs: number;
  runs_off_bat?: number; // batsman runs (e.g. runs scored off bat on extras)
  is_extra: boolean;
  extra_type: 'None' | 'Wide' | 'No Ball' | 'Bye' | 'Leg Bye';
  is_wicket: boolean;
  dismissal_type: 'None' | 'Bawled' | 'Catch' | 'Run Out' | 'Stumped' | 'Hit Wicket' | 'Retired Out';
  out_player: string; // Player ID or empty
  fielder: string; // Player ID or empty
  created?: string;
  updated?: string;
  expand?: {
    striker?: Player;
    bawler?: Player;
    out_player?: Player;
    fielder?: Player;
  };
}

export interface News {
  id: string;
  headline: string;
  description: string;
  photos: string[];
  created?: string;
  updated?: string;
}

export interface TournamentConfig {
  id: string;
  man_of_the_series?: string;
  mos_performance?: string;
  show_epf_number?: boolean;
  strict_fantasy_roles?: boolean;
  stats_from_phase?: 'All' | 'Quarter Finals' | 'Semi Finals';
  created?: string;
  updated?: string;
  expand?: {
    man_of_the_series?: Player;
  };
}

export interface FantasyTeam {
  id: string;
  name: string;
  owner_name: string;
  players: string[];
  captain?: string; // Player ID
  vice_captain?: string; // Player ID
  fingerprint?: string;
  created?: string;
  updated?: string;
  expand?: {
    players?: Player[];
    captain?: Player;
    vice_captain?: Player;
  };
}

export interface MatchVote {
  id: string;
  match: string;
  team: string;
  created?: string;
  updated?: string;
}

export type UserRole = 'superuser' | 'scorer' | 'news' | 'display';

export const getUserRole = (): UserRole => {
  if (!pb.authStore.isValid || !pb.authStore.model) return 'scorer';
  
  const model = pb.authStore.model;
  if (model && 'email' in model) {
    const email = (model.email || '').toLowerCase();
    const isUserCollection = 'collectionName' in model && model.collectionName === 'users';
    if (isUserCollection) {
      if (email.includes('news') || email.includes('media') || email.includes('pr')) {
        return 'news';
      }
      if (email.includes('display') || email.includes('screen') || email.includes('led')) {
        return 'display';
      }
      return 'scorer';
    }
  }
  return 'superuser';
};

