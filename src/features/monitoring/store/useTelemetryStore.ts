import { create } from "zustand";

import type {
  RotaResponse,
  TelemetriaResponse,
  WSTelemetriaPayload,
} from "../../../types/api";

export interface StoreState {
  currentFrame: TelemetriaResponse | null;
  history: TelemetriaResponse[];
  isReplaying: boolean;
  streamConnected: boolean;
  streamError: string | null;
  routePreview: [number, number][];
  selectedDroneId: string;
  setFrame: (frame: TelemetriaResponse) => void;
  appendHistory: (frame: TelemetriaResponse) => void;
  setReplaying: (value: boolean) => void;
  setStreamState: (connected: boolean, error: string | null) => void;
  setRoutePreview: (rota: RotaResponse | null) => void;
  setSelectedDroneId: (droneId: string) => void;
  reset: () => void;
}

const INITIAL_HISTORY: WSTelemetriaPayload[] = [];

function isSameFrame(
  currentFrame: TelemetriaResponse,
  nextFrame: TelemetriaResponse,
): boolean {
  return (
    currentFrame.id === nextFrame.id &&
    currentFrame.criado_em === nextFrame.criado_em
  );
}

export const useTelemetryStore = create<StoreState>((set) => ({
  currentFrame: null,
  history: INITIAL_HISTORY,
  isReplaying: false,
  streamConnected: false,
  streamError: null,
  routePreview: [],
  selectedDroneId: "",
  setFrame: (frame) => {
    set({ currentFrame: frame });
  },
  appendHistory: (frame) => {
    set((state) => {
      const lastFrame = state.history[state.history.length - 1];

      if (lastFrame !== undefined && isSameFrame(lastFrame, frame)) {
        return state;
      }

      return { history: [...state.history, frame] };
    });
  },
  setReplaying: (value) => {
    set({ isReplaying: value });
  },
  setStreamState: (connected, error) => {
    set({ streamConnected: connected, streamError: error });
  },
  setRoutePreview: (rota) => {
    set({
      routePreview:
        rota?.waypoints.map((waypoint) => [waypoint.latitude, waypoint.longitude]) ??
        [],
    });
  },
  setSelectedDroneId: (droneId) => {
    set({ selectedDroneId: droneId });
  },
  reset: () => {
    set({
      currentFrame: null,
      history: [],
      isReplaying: false,
      streamConnected: false,
      streamError: null,
      routePreview: [],
      selectedDroneId: "",
    });
  },
}));
