import { create } from "zustand";

import type {
  TelemetriaResponse,
  WSTelemetriaPayload,
} from "../../../types/api";

export interface StoreState {
  currentFrame: TelemetriaResponse | null;
  history: TelemetriaResponse[];
  isReplaying: boolean;
  setFrame: (frame: TelemetriaResponse) => void;
  appendHistory: (frame: TelemetriaResponse) => void;
  setReplaying: (value: boolean) => void;
  reset: () => void;
}

const INITIAL_HISTORY: WSTelemetriaPayload[] = [];

export const useTelemetryStore = create<StoreState>((set) => ({
  currentFrame: null,
  history: INITIAL_HISTORY,
  isReplaying: false,
  setFrame: (frame) => {
    set({ currentFrame: frame });
  },
  appendHistory: (frame) => {
    set((state) => ({ history: [...state.history, frame] }));
  },
  setReplaying: (value) => {
    set({ isReplaying: value });
  },
  reset: () => {
    set({
      currentFrame: null,
      history: [],
      isReplaying: false,
    });
  },
}));
