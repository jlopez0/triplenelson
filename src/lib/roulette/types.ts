export type RouletteStatus =
  | "lobby"
  | "betting_open"
  | "spinning"
  | "result"
  | "finished";

export type RouletteColor = "red" | "black" | "green";

export type BetType =
  | "number"
  | "corner"
  | "red"
  | "black"
  | "even"
  | "odd"
  | "low"
  | "high"
  | "dozen1"
  | "dozen2"
  | "dozen3";

export interface Bet {
  type: BetType;
  value: number | null;
  amount: number;
}

export interface RouletteConfig {
  initialCredits: number;
  createdAt: number;
}

export interface RouletteRound {
  index: number;
  startedAt: number;
  timeLimit: number;
  result: number | null;
  color: RouletteColor | null;
  allBetsIn: boolean;
}

export interface RoulettePlayer {
  name: string;
  credits: number;
  hasBet: boolean;
  eliminated: boolean;
  joinedAt: number;
  lastDelta?: number;
  lastResultRound?: number;
  bets: Bet[];
}

export interface RouletteHistoryEntry {
  round: number;
  result: number;
  color: RouletteColor;
}

export interface RouletteSession {
  status: RouletteStatus;
  config: RouletteConfig;
  currentRound: RouletteRound;
  players?: Record<string, RoulettePlayer>;
  history?: RouletteHistoryEntry[];
}

export interface WheelDataItem {
  option: string;
  style: { backgroundColor: string; textColor: string };
}

export interface RouletteLeaderboardEntry {
  playerId: string;
  name: string;
  credits: number;
  eliminated: boolean;
  rank: number;
}
