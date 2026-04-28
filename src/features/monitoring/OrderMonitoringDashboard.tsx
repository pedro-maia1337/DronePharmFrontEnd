import { useEffect, useMemo, useState, type ReactElement } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/api/client";
import { cancelarPedido, entregarPedido, getPedido, getPedidoAtivo } from "@/api/pedidos";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatEta } from "@/lib/utils";
import type { HTTPValidationError, PedidoStatus } from "@/types/api";

import { MapCanvas } from "./components/MapCanvas";
import { ReplayTimeline } from "./components/ReplayTimeline";
import { StatusControl } from "./components/StatusControl";
import { TelemetryGrid } from "./components/TelemetryGrid";
import { useOrderStream } from "./hooks/useOrderStream";
import {
  buildMonitoringSnapshot,
  getMonitoringBadgeClassName,
  getRouteProgress,
} from "./monitoringUtils";
import { useTelemetryStore } from "./store/useTelemetryStore";

const QUERY_STALE_TIME = 10_000;
const DASHBOARD_CLASS_NAME = "flex h-[calc(100dvh-56px)] overflow-hidden";
const MAP_PANEL_CLASS_NAME = "w-[70%] shrink-0 p-5";
const SIDEBAR_CLASS_NAME =
  "flex w-[30%] min-w-[320px] max-w-[420px] shrink-0 flex-col overflow-y-auto border-l border-[var(--surface-border)] bg-[var(--surface-panel)]";
const SECTION_CLASS_NAME =
  "border-b border-[var(--surface-border)] px-5 py-[14px]";
const SECTION_TITLE_CLASS_NAME =
  "mb-[10px] text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]";
const FULLSCREEN_STATE_CLASS_NAME =
  "flex h-[calc(100dvh-56px)] items-center justify-center bg-[var(--surface-base)] p-6";
const ERROR_STATE_CARD_CLASS_NAME =
  "flex max-w-md flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[var(--surface-panel)] p-6 text-center";

interface OrderMonitoringDashboardProps {
  pedidoId: number;
}

function isValidationError(error: unknown): error is HTTPValidationError {
  return typeof error === "object" && error !== null && "detail" in error;
}

function getValidationErrorMessage(error: unknown): string | null {
  if (!isValidationError(error)) {
    return null;
  }

  return error.detail?.[0]?.msg ?? null;
}

function getErrorMessage(error: unknown): string {
  const validationMessage = getValidationErrorMessage(error);

  if (validationMessage !== null) {
    return validationMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Nao foi possivel carregar o pedido.";
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

function renderLoadingState(): ReactElement {
  return (
    <div className={FULLSCREEN_STATE_CLASS_NAME}>
      <div className="flex h-full w-full gap-4">
        <Skeleton className="h-full w-[70%] rounded-[var(--radius-lg)]" />
        <div className="flex h-full w-[30%] min-w-[320px] max-w-[420px] flex-col gap-4">
          <Skeleton className="h-20 rounded-[var(--radius-lg)]" />
          <Skeleton className="h-56 rounded-[var(--radius-lg)]" />
          <Skeleton className="h-40 rounded-[var(--radius-lg)]" />
          <Skeleton className="h-40 rounded-[var(--radius-lg)]" />
        </div>
      </div>
    </div>
  );
}

function renderErrorState(message: string, onRetry: () => void): ReactElement {
  return (
    <div className={FULLSCREEN_STATE_CLASS_NAME}>
      <div className={ERROR_STATE_CARD_CLASS_NAME}>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Falha ao carregar monitoramento
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">{message}</p>
        <Button type="button" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}

function renderHeader(
  pedidoId: number,
  status: PedidoStatus,
): ReactElement {
  const badgeClassName = getMonitoringBadgeClassName(status);

  return (
    <header className="border-b border-[var(--surface-border)] px-5 py-[14px]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[1.0625rem] font-semibold text-[var(--text-primary)]">
          Pedido #{pedidoId}
        </span>
        <span className={`badge ${badgeClassName}`} translate="no">
          {status}
        </span>
      </div>
    </header>
  );
}

function renderProgressSection(
  progressPct: number | null,
  tempoDecorridoSegundos: number | null,
  estimativaEntregaEm: string | null,
): ReactElement {
  const width = progressPct === null ? 0 : Math.min(Math.max(progressPct, 0), 100);
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeStyle: "short",
  });
  const estimativaLabel =
    estimativaEntregaEm === null
      ? "--"
      : formatter.format(new Date(estimativaEntregaEm));
  const decorridoLabel =
    tempoDecorridoSegundos === null ? "--" : formatEta(tempoDecorridoSegundos);

  return (
    <section className={SECTION_CLASS_NAME} aria-label="Progresso do trajeto">
      <div className={SECTION_TITLE_CLASS_NAME}>Progresso do Trajeto</div>
      <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--text-secondary)]">Conclusao</span>
          <span className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
            {progressPct === null ? "--" : `${progressPct}%`}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-border)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-200"
            style={{ width: `${width}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs text-[var(--text-secondary)]">
          <div>
            <span className="block">Decorrido</span>
            <span className="font-mono text-[var(--text-primary)]">
              {decorridoLabel}
            </span>
          </div>
          <div>
            <span className="block">ETA previsto</span>
            <span className="font-mono text-[var(--text-primary)]">
              {estimativaLabel}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function OrderMonitoringDashboard({
  pedidoId,
}: OrderMonitoringDashboardProps): ReactElement {
  const queryClient = useQueryClient();
  const [replayVisible, setReplayVisible] = useState(false);
  const currentFrame = useTelemetryStore((state) => state.currentFrame);
  const historyLength = useTelemetryStore((state) => state.history.length);
  const resetTelemetry = useTelemetryStore((state) => state.reset);
  const pedidoQuery = useQuery({
    queryKey: ["pedido", pedidoId],
    queryFn: () => getPedido(pedidoId),
    staleTime: QUERY_STALE_TIME,
  });
  const pedidoAtivoQuery = useQuery({
    queryKey: ["pedido-ativo", pedidoId],
    queryFn: () => getPedidoAtivo(pedidoId),
    staleTime: QUERY_STALE_TIME,
    retry: false,
  });
  const snapshot = useMemo(() => {
    return buildMonitoringSnapshot(
      pedidoAtivoQuery.data ?? null,
      pedidoQuery.data ?? null,
    );
  }, [pedidoAtivoQuery.data, pedidoQuery.data]);
  const orderStream = useOrderStream(snapshot?.droneId ?? "");
  const progressPct = useMemo(() => {
    if (snapshot === null) {
      return null;
    }

    const currentPosition =
      currentFrame !== null
        ? ([currentFrame.latitude, currentFrame.longitude] as [number, number])
        : snapshot.positionSnapshot?.latitude !== null &&
            snapshot.positionSnapshot?.latitude !== undefined &&
            snapshot.positionSnapshot?.longitude !== null &&
            snapshot.positionSnapshot?.longitude !== undefined
          ? ([
              snapshot.positionSnapshot.latitude,
              snapshot.positionSnapshot.longitude,
            ] as [number, number])
          : null;

    return getRouteProgress(snapshot.routePoints, currentPosition);
  }, [currentFrame, snapshot]);

  useEffect(() => {
    resetTelemetry();
  }, [pedidoId, resetTelemetry]);

  useEffect(() => {
    if (!pedidoAtivoQuery.isError) {
      return;
    }

    if (
      isNotFoundError(pedidoAtivoQuery.error) &&
      pedidoQuery.data?.status !== "em_voo"
    ) {
      return;
    }

    toast.error(getErrorMessage(pedidoAtivoQuery.error));
  }, [
    pedidoAtivoQuery.error,
    pedidoAtivoQuery.isError,
    pedidoQuery.data?.status,
  ]);

  useEffect(() => {
    if (orderStream.error === null) {
      return;
    }

    toast.error(orderStream.error);
  }, [orderStream.error]);

  async function refreshQueries(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["pedido", pedidoId] }),
      queryClient.invalidateQueries({ queryKey: ["pedido-ativo", pedidoId] }),
      queryClient.invalidateQueries({ queryKey: ["monitoring-pedidos"] }),
    ]);
  }

  async function handleCancelar(): Promise<void> {
    try {
      await cancelarPedido(pedidoId);
      await refreshQueries();
      toast.success("Pedido cancelado com sucesso.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function handleEntregar(): Promise<void> {
    try {
      await entregarPedido(pedidoId);
      await refreshQueries();
      toast.success("Entrega confirmada com sucesso.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  function handleRetry(): void {
    void Promise.all([pedidoQuery.refetch(), pedidoAtivoQuery.refetch()]);
  }

  if (pedidoQuery.isLoading && pedidoAtivoQuery.isLoading) {
    return renderLoadingState();
  }

  if (snapshot === null) {
    return renderErrorState(
      getErrorMessage(pedidoQuery.error ?? pedidoAtivoQuery.error),
      handleRetry,
    );
  }

  return (
    <section className={DASHBOARD_CLASS_NAME}>
      <div className={MAP_PANEL_CLASS_NAME}>
        <MapCanvas
          routePoints={snapshot.routePoints}
          destination={snapshot.destination}
          currentFrame={currentFrame}
          positionSnapshot={snapshot.positionSnapshot}
        />
      </div>

      <aside className={SIDEBAR_CLASS_NAME}>
        {renderHeader(snapshot.pedidoId, snapshot.status)}
        <TelemetryGrid
          etaSegundos={snapshot.etaSegundos}
          progressPct={progressPct}
          connected={orderStream.connected}
          positionSnapshot={snapshot.positionSnapshot}
        />
        {renderProgressSection(
          progressPct,
          snapshot.tempoDecorridoSegundos,
          snapshot.estimativaEntregaEm,
        )}
        <StatusControl
          status={snapshot.status}
          pedidoId={snapshot.pedidoId}
          replayEnabled={historyLength > 0}
          replayVisible={replayVisible}
          onCancelar={handleCancelar}
          onEntregar={handleEntregar}
          onToggleReplay={() => setReplayVisible((currentValue) => !currentValue)}
        />
        {replayVisible ? <ReplayTimeline /> : null}
      </aside>
    </section>
  );
}
