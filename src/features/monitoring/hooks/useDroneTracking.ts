import { useEffect } from "react";

import type { WSTelemetriaPayload } from "../../../types/api";
import { useTelemetryStore } from "../store/useTelemetryStore";

const BASE_RETRY_DELAY_MS = 1000;
const MAX_RECONNECT_ATTEMPTS = 5;
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
  return BASE_RETRY_DELAY_MS * 2 ** attempt;
}

function buildWebSocketUrl(droneId: string): string {
  const configuredBaseUrl = import.meta.env.VITE_WS_URL?.trim();

  if (configuredBaseUrl) {
    return `${configuredBaseUrl.replace(/\/+$/, "")}/ws/telemetria/${droneId}`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

  return `${protocol}//${window.location.host}/ws/telemetria/${droneId}`;
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

    const connect = (): void => {
      if (cancelled) {
        return;
      }

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
              setStreamState(
                droneId,
                false,
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

            setStreamState(
              droneId,
              false,
              `Falha ao processar mensagem do WebSocket: ${message}`,
            );
          }
        };

        socket.onerror = () => {
          setStreamState(droneId, false, "Erro de conexao no canal de telemetria.");
        };

        socket.onclose = (event) => {
          socket = null;
          setStreamState(droneId, false, null);

          if (
            cancelled ||
            event.code === NORMAL_CLOSE_CODE ||
            reconnectAttempts >= MAX_RECONNECT_ATTEMPTS
          ) {
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
              setStreamState(
                droneId,
                false,
                "Nao foi possivel reconectar ao stream de telemetria.",
              );
            }

            return;
          }

          reconnectTimerId = window.setTimeout(() => {
            reconnectAttempts += 1;
            connect();
          }, getReconnectDelay(reconnectAttempts));
        };
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Falha desconhecida ao abrir WebSocket.";

        setStreamState(droneId, false, `Nao foi possivel iniciar o stream: ${message}`);
      }
    };

    connect();

    return () => {
      cancelled = true;
      clearReconnectTimer(reconnectTimerId);
      socket?.close();
      socket = null;
      setStreamState(droneId, false, null);
    };
  }, [appendHistory, droneId, setFrame, setStreamState]);

  return streamState;
}
