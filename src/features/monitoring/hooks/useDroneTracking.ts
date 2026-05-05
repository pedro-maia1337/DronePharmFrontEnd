import { useEffect } from "react";

import type { WSTelemetriaPayload } from "../../../types/api";
import { useTelemetryStore } from "../store/useTelemetryStore";

const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 8;
const NORMAL_CLOSE_CODE = 1000;

interface DroneTrackingState {
  connected: boolean;
  error: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isWSTelemetriaPayload(value: unknown): value is WSTelemetriaPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "number" &&
    typeof value.drone_id === "string" &&
    typeof value.latitude === "number" &&
    typeof value.longitude === "number" &&
    typeof value.altitude_m === "number" &&
    typeof value.velocidade_ms === "number" &&
    typeof value.bateria_pct === "number" &&
    typeof value.vento_ms === "number" &&
    typeof value.direcao_vento === "number" &&
    typeof value.status === "string" &&
    typeof value.criado_em === "string"
  );
}

function clearReconnectTimer(timerId: number | null): void {
  if (timerId !== null) {
    window.clearTimeout(timerId);
  }
}

function getReconnectDelay(attempt: number): number {
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);
}

function getWebSocketOrigin(): string {
  const configuredWebSocketUrl = import.meta.env.VITE_WS_URL?.trim();

  if (configuredWebSocketUrl) {
    return configuredWebSocketUrl.replace(/\/+$/, "");
  }

  const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

  if (configuredApiUrl) {
    const apiUrl = new URL(configuredApiUrl);
    const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";

    return `${protocol}//${apiUrl.host}`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

  return `${protocol}//${window.location.host}`;
}

function buildWebSocketUrl(droneId: string): string {
  const token = import.meta.env.VITE_API_TOKEN?.trim();
  const url = new URL(`/ws/telemetria/${encodeURIComponent(droneId)}`, getWebSocketOrigin());

  if (token) {
    url.searchParams.set("token", token);
  }

  return url.toString();
}

function getCloseMessage(event: CloseEvent): string {
  if (event.reason.trim().length > 0) {
    return event.reason;
  }

  return `Conexao encerrada (codigo ${event.code}).`;
}

export function useDroneTracking(droneId: string): DroneTrackingState {
  const setFrame = useTelemetryStore((state) => state.setFrame);
  const appendHistory = useTelemetryStore((state) => state.appendHistory);
  const setStreamState = useTelemetryStore((state) => state.setStreamState);
  const streamState = useTelemetryStore((state) => state.getStreamState(droneId));

  useEffect(() => {
    if (!droneId) {
      return;
    }

    let reconnectAttempts = 0;
    let reconnectTimerId: number | null = null;
    let socket: WebSocket | null = null;
    let cancelled = false;

    const cleanupSocket = (): void => {
      if (socket === null) {
        return;
      }

      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;

      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close(NORMAL_CLOSE_CODE, "cleanup");
      }

      socket = null;
    };

    const scheduleReconnect = (message: string | null): void => {
      cleanupSocket();
      clearReconnectTimer(reconnectTimerId);

      if (cancelled) {
        return;
      }

      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        setStreamState(
          droneId,
          false,
          message ?? "Nao foi possivel reconectar ao stream de telemetria.",
        );
        return;
      }

      const delay = getReconnectDelay(reconnectAttempts);
      reconnectAttempts += 1;
      setStreamState(
        droneId,
        false,
        message ?? `Tentando reconectar em ${Math.round(delay / 1000)}s.`,
      );

      reconnectTimerId = window.setTimeout(() => {
        connect();
      }, delay);
    };

    const connect = (): void => {
      if (cancelled) {
        return;
      }

      clearReconnectTimer(reconnectTimerId);
      cleanupSocket();

      try {
        socket = new WebSocket(buildWebSocketUrl(droneId));

        socket.onopen = () => {
          reconnectAttempts = 0;
          setStreamState(droneId, true, null);
        };

        socket.onmessage = (event) => {
          try {
            const parsedPayload: unknown = JSON.parse(event.data);

            if (!isWSTelemetriaPayload(parsedPayload)) {
              scheduleReconnect(
                "Payload de telemetria invalido recebido pelo WebSocket.",
              );
              return;
            }

            setFrame(parsedPayload.drone_id, parsedPayload);
            appendHistory(parsedPayload.drone_id, parsedPayload);
            setStreamState(parsedPayload.drone_id, true, null);
          } catch (caughtError) {
            const message =
              caughtError instanceof Error
                ? caughtError.message
                : "Falha desconhecida ao processar telemetria.";

            scheduleReconnect(
              `Falha ao processar mensagem do WebSocket: ${message}`,
            );
          }
        };

        socket.onerror = () => {
          setStreamState(droneId, false, "Erro de conexao no canal de telemetria.");
        };

        socket.onclose = (event) => {
          if (cancelled || event.code === NORMAL_CLOSE_CODE) {
            cleanupSocket();
            setStreamState(droneId, false, null);
            return;
          }

          scheduleReconnect(getCloseMessage(event));
        };
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Falha desconhecida ao abrir WebSocket.";

        scheduleReconnect(`Nao foi possivel iniciar o stream: ${message}`);
      }
    };

    connect();

    return () => {
      cancelled = true;
      clearReconnectTimer(reconnectTimerId);
      cleanupSocket();
      setStreamState(droneId, false, null);
    };
  }, [appendHistory, droneId, setFrame, setStreamState]);

  return streamState;
}
