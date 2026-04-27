export type GameStatus = "lobby" | "question" | "leaderboard" | "finished";

export type AnswerIndex = 0 | 1 | 2 | 3;

export type AnswerOptions = [string, string, string, string];

export interface QuizQuestion {
  text: string;
  imageUrl: string | null;
  options: AnswerOptions;
  correctIndex: AnswerIndex;
  timeLimit: number;
}

export interface Quiz {
  id: string;
  title: string;
  event: string;
  createdAt: number;
  questions: QuizQuestion[];
}

export interface QuizInput {
  title: string;
  event: string;
  questions: QuizQuestion[];
}

export interface ActiveQuestion {
  text: string;
  imageUrl: string | null;
  options: AnswerOptions;
  timeLimit: number;
  startedAt: number;
  correctIndex?: AnswerIndex;
}

export interface GamePlayer {
  name: string;
  score: number;
  answered: boolean;
  joinedAt: number;
  lastGain?: number;
  lastQuestionIndex?: number;
}

export interface GameAnswer {
  optionIndex: AnswerIndex;
  timeMs: number;
  submittedAt?: number;
}

export interface GameState {
  quizId: string;
  status: GameStatus;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentQuestion: ActiveQuestion | null;
  createdAt: number;
  players?: Record<string, GamePlayer>;
  answers?: Record<string, Record<string, GameAnswer>>;
  scoredQuestions?: Record<string, { scoredAt?: number; correctIndex?: number }>;
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  score: number;
  lastGain?: number;
  rank: number;
}

export interface QuizDraftQuestion extends QuizQuestion {
  localPreviewUrl?: string;
  pendingImageFile?: File | null;
}
