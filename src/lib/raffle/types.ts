export type RaffleStatus = "idle" | "spinning" | "result";

export interface Papeleta {
  name: string;
  intentId: string;
}

export interface DrawResult {
  draw: number;
  winnerName: string;
  winnerIntentId: string;
}

export interface RaffleCurrentDraw {
  index: number;
  winnerName: string | null;
  winnerIntentId: string | null;
}

export interface RaffleSession {
  status: RaffleStatus;
  poolSize: number;
  uniqueParticipants: number;
  jcoins: number;
  participantNames?: string[];
  currentDraw: RaffleCurrentDraw;
  history?: DrawResult[];
}
