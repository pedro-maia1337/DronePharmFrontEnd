import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

import type { WSTelemetriaPayload } from "../../../types/api";
import { useTelemetryStore } from "../store/useTelemetryStore";

const BASE_RETRY_DELAY_MS = 1000;
const MAX_RECONNECT_ATTEMPTS = 5;
const NORMAL_CLOSE_CODE = 1000;

interface OrderStreamState {
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

function clearReconnectTimer(
  timerRef: MutableRefObject<number | null>,
): void {
  if (timerRef.current === null) {
    return;
  }

  window.clearTimeout(timerRef.current);
  timerRef.current = null;
}

function getReconnectDelay(attempt: number): number {
  return BASE_RETRY_DELAY_MS * 2 ** attempt;
}

export function useOrderStream(droneId: string): OrderStreamState {
  const setFrame = useTelemetryStore((state) => state.setFrame);
  const appendHistory = useTelemetryStore((state) => state.appendHistory);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMessage = useEffectEvent((event: MessageEvent<string>) => {
    try {
      const parsedPayload: unknown = JSON.parse(event.data);

      if (!isWSTelemetriaPayload(parsedPayload)) {
        setError("Payload de telemetria invalido recebido pelo WebSocket.");
        return;
      }

      setFrame(parsedPayload);
      appendHistory(parsedPayload);
      setError(null);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Falha desconhecida ao processar telemetria.";

      setError(`Falha ao processar mensagem do WebSocket: ${message}`);
    }
  });

  const connect = useEffectEvent(() => {
    if (!droneId || !shouldReconnectRef.current) {
      return;
    }

    if (socketRef.current !== null) {
      return;
    }

    clearReconnectTimer(reconnectTimerRef);

    try {
      const wsUrl = `${import.meta.env.VITE_WS_URL}/ws/telemetria/${droneId}`;
      const socket = new WebSocket(wsUrl);

      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setConnected(true);
        setError(null);
      };

      socket.onmessage = (event) => {
        handleMessage(event);
      };

      socket.onerror = () => {
        setConnected(false);
        setError("Erro de conexao no canal de telemetria.");
      };

      socket.onclose = (event) => {
        setConnected(false);
        socketRef.current = null;

        if (!shouldReconnectRef.current || event.code === NORMAL_CLOSE_CODE) {
          return;
        }

        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setError("Nao foi possivel reconectar ao stream de telemetria.");
          return;
        }

        const attempt = reconnectAttemptsRef.current;
        const delay = getReconnectDelay(attempt);

        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, delay);
      };
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Falha desconhecida ao abrir WebSocket.";

      setConnected(false);
      setError(`Nao foi possivel iniciar o stream: ${message}`);
    }
  });

  useEffect(() => {
    shouldReconnectRef.current = true;
    reconnectAttemptsRef.current = 0;
    setConnected(false);

    if (!droneId) {
      setError(null);
      return () => {
        shouldReconnectRef.current = false;
        clearReconnectTimer(reconnectTimerRef);
        socketRef.current?.close();
        socketRef.current = null;
      };
    }

    connect();

    return () => {
      shouldReconnectRef.current = false;
      clearReconnectTimer(reconnectTimerRef);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [connect, droneId]);

  return { connected, error };
}
