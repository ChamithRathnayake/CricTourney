export interface ParsedStage {
  round: number; // 1 for Final, 2 for Semi Final, 3 for Quarter Final, 4 for Round of 16, 5 for Round of 32
  matchIndex: number; // 1-indexed
  name: string; // Display name
}

export const parseStage = (stageName: string): ParsedStage => {
  if (stageName === 'Final') {
    return { round: 1, matchIndex: 1, name: 'Grand Final' };
  }
  if (stageName.startsWith('Semi Final')) {
    const idx = parseInt(stageName.replace('Semi Final ', '')) || 1;
    return { round: 2, matchIndex: idx, name: `Semi Final ${idx}` };
  }
  if (stageName.startsWith('Quarter Final')) {
    const idx = parseInt(stageName.replace('Quarter Final ', '')) || 1;
    return { round: 3, matchIndex: idx, name: `Quarter Final ${idx}` };
  }
  if (stageName.startsWith('Round of 16')) {
    const idx = parseInt(stageName.replace('Round of 16 - Match ', '')) || 1;
    return { round: 4, matchIndex: idx, name: `Round of 16 - Match ${idx}` };
  }
  if (stageName.startsWith('Round of 32')) {
    const idx = parseInt(stageName.replace('Round of 32 - Match ', '')) || 1;
    return { round: 5, matchIndex: idx, name: `Round of 32 - Match ${idx}` };
  }
  return { round: 1, matchIndex: 1, name: stageName };
};

export const getRoundName = (round: number): string => {
  switch (round) {
    case 1: return 'Grand Final';
    case 2: return 'Semi-Finals';
    case 3: return 'Quarter-Finals';
    case 4: return 'Round of 16';
    case 5: return 'Round of 32';
    default: return `Round ${round}`;
  }
};

export const getStageName = (round: number, matchIndex: number): string => {
  if (round === 1) return 'Final';
  if (round === 2) return `Semi Final ${matchIndex}`;
  if (round === 3) return `Quarter Final ${matchIndex}`;
  if (round === 4) return `Round of 16 - Match ${matchIndex}`;
  if (round === 5) return `Round of 32 - Match ${matchIndex}`;
  return `Round ${round} - Match ${matchIndex}`;
};
