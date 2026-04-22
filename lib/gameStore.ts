import { create } from "zustand";
import type { Question } from "@/lib/types";

export type GameStatus = "idle" | "running" | "won" | "eliminated";

type GameState = {
  targetLane: number;
  timeLeft: number;
  aliveCount: number;
  poolCount: number;
  lives: number;
  score: number;
  correctAnswers: number;
  status: GameStatus;
  activeQuestionIndex: number;
  restartSeed: number;
  questionBank: Question[];
  stakeId: bigint | null;
  setTargetLane: (lane: number) => void;
  setTimeLeft: (timeLeft: number) => void;
  setAliveCount: (aliveCount: number) => void;
  setPoolCount: (poolCount: number) => void;
  setStatus: (status: GameStatus) => void;
  setActiveQuestionIndex: (questionIndex: number) => void;
  setQuestionBank: (questions: Question[]) => void;
  setStakeId: (id: bigint | null) => void;
  startGame: () => void;
  returnToTitle: () => void;
};

const playState = {
  targetLane: 1,
  timeLeft: 6,
  aliveCount: 6,
  poolCount: 7,
  lives: 3,
  score: 0,
  correctAnswers: 0,
  activeQuestionIndex: 0,
};

const initialState = {
  ...playState,
  status: "idle" as GameStatus,
  restartSeed: 0,
  questionBank: [] as Question[],
  stakeId: null as bigint | null,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,
  setTargetLane: (lane) => set({ targetLane: lane }),
  setTimeLeft: (timeLeft) => set({ timeLeft: Math.max(0, timeLeft) }),
  setAliveCount: (aliveCount) => set({ aliveCount: Math.max(0, aliveCount) }),
  setPoolCount: (poolCount) => set({ poolCount }),
  setStatus: (status) => set({ status }),
  setActiveQuestionIndex: (activeQuestionIndex) => set({ activeQuestionIndex }),
  setQuestionBank: (questionBank) => set({ questionBank }),
  setStakeId: (stakeId) => set({ stakeId }),
  startGame: () =>
    set((state) => ({
      ...playState,
      status: "running" as const,
      restartSeed: state.restartSeed + 1,
      questionBank: state.questionBank,
      stakeId: state.stakeId,
    })),
  returnToTitle: () =>
    set((state) => ({
      ...initialState,
      restartSeed: state.restartSeed + 1,
    })),
}));
