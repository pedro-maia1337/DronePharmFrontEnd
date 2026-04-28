import { useEffect, type ReactElement } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { cancelarPedido, entregarPedido, getPedidoAtivo } from "@/api/pedidos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { HTTPValidationError, PedidoAtivoResponse } from "@/types/api";

import { MapCanvas } from "./components/MapCanvas";
import { ReplayTimeline } from "./components/ReplayTimeline";
import { StatusControl } from "./components/StatusControl";
import { TelemetryGrid } from "./components/TelemetryGrid";
import { useOrderStream } from "./hooks/useOrderStream";
import { useTelemetryStore } from "./store/useTelemetryStore";

const QUERY_STALE_TIME = 10_000;
const DASHBOARD_CLASS_NAME =
  "flex h-dvh overflow-hidden bg-background text-foreground";
const MAP_PANEL_CLASS_NAME = "h-full w-[70%] shrink-0 p-4";
const SIDEBAR_CLASS_NAME =
  "flex h-full w-[30%] min-w-[320px] max-w-[420px] flex-col gap-4 overflow-y-auto border-l border-border bg-card p-4";
const FULLSCREEN_STATE_CLASS_NAME =
  "flex h-dvh items-center justify-center bg-background p-6";
const ERROR_STATE_CARD_CLASS_NAME =
  "flex max-w-md flex-col gap-4 rounded-xl border border-border bg-card p-6 text-center";

interface OrderMonitoringDashboardProps {
  pedidoId: number;
}

function isValidationError(error: unknown): error is HTTPValidationError {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  return "detail" in error;
}

function getValidationErrorMessage(error: unknown): string | null {
  if (!isValidationError(error)) {
    return null;
  }

  const firstDetail = error.detail?.[0];

  return firstDetail?.msg ?? null;
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

function getMonitoringErrorMessage(error: unknown): string {
  const validationMessage = getValidationErrorMessage(error);

  if (validationMessage !== null) {
    return "O pedido ainda nao iniciou a telemetria. Aguarde o drone entrar em operacao e tente novamente.";
  }

  return getErrorMessage(error);
}

function getStatusBadgeClassName(status: PedidoAtivoResponse["status"]): string {
  switch (status) {
    case "pendente":
      return "border-border bg-muted text-muted-foreground";
    case "calculado":
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
    case "despachado":
      return "border-sky-500/30 bg-sky-500/10 text-sky-300";
    case "em_voo":
      return "border-sky-400/40 bg-sky-500/10 text-sky-300";
    case "entregue":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "cancelado":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "falha":
      return "border-orange-500/30 bg-orange-500/10 text-orange-300";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function renderLoadingState(): ReactElement {
  return (
    <div className={FULLSCREEN_STATE_CLASS_NAME}>
      <div className="flex h-full w-full gap-4">
        <Skeleton className="h-full w-[70%] rounded-xl" />
        <div className="flex h-full w-[30%] min-w-[320px] max-w-[420px] flex-col gap-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function renderErrorState(
  message: string,
  onRetry: () => void,
): ReactElement {
  return (
    <div className={FULLSCREEN_STATE_CLASS_NAME}>
      <div className={ERROR_STATE_CARD_CLASS_NAME}>
        <h2 className="text-lg font-semibold text-foreground">
          Falha ao carregar monitoramento
        </h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button type="button" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}

function renderHeader(pedidoAtivo: PedidoAtivoResponse): ReactElement {
  return (
    <header className="flex items-start justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-foreground">
          Pedido #{pedidoAtivo.pedido_id}
        </h1>
        <p className="text-sm text-muted-foreground">
          Acompanhamento operacional em tempo real
        </p>
      </div>
      <Badge
        variant="outline"
        className={`h-7 rounded-md px-3 text-sm font-medium ${getStatusBadgeClassName(
          pedidoAtivo.status,
        )}`}
      >
        {pedidoAtivo.status}
      </Badge>
    </header>
  );
}

export function OrderMonitoringDashboard({
  pedidoId,
}: OrderMonitoringDashboardProps): ReactElement {
  const queryClient = useQueryClient();
  const currentFrame = useTelemetryStore((state) => state.currentFrame);
  const resetTelemetry = useTelemetryStore((state) => state.reset);
  const pedidoAtivoQuery = useQuery({
    queryKey: ["pedido-ativo", pedidoId],
    queryFn: () => getPedidoAtivo(pedidoId),
    staleTime: QUERY_STALE_TIME,
    refetchInterval: false,
  });
  const droneId = pedidoAtivoQuery.data?.drone?.id ?? "";

  useOrderStream(droneId);

  useEffect(() => {
    resetTelemetry();
  }, [pedidoId, resetTelemetry]);

  useEffect(() => {
    if (!pedidoAtivoQuery.isError) {
      return;
    }

    toast.error(getMonitoringErrorMessage(pedidoAtivoQuery.error));
  }, [pedidoAtivoQuery.error, pedidoAtivoQuery.isError]);

  async function invalidatePedidoAtivoQuery(): Promise<void> {
    await queryClient.invalidateQueries({
      queryKey: ["pedido-ativo", pedidoId],
    });
  }

  function handleActionError(error: unknown): void {
    const validationMessage = getValidationErrorMessage(error);

    if (validationMessage !== null) {
      toast.error(validationMessage);
      return;
    }

    toast.error(getErrorMessage(error));
  }

  async function handleCancelar(): Promise<void> {
    try {
      await cancelarPedido(pedidoId);
      await invalidatePedidoAtivoQuery();
    } catch (error) {
      handleActionError(error);
    }
  }

  async function handleEntregar(): Promise<void> {
    try {
      await entregarPedido(pedidoId);
      await invalidatePedidoAtivoQuery();
    } catch (error) {
      handleActionError(error);
    }
  }

  if (pedidoAtivoQuery.isLoading) {
    return renderLoadingState();
  }

  if (pedidoAtivoQuery.isError || pedidoAtivoQuery.data === undefined) {
    return renderErrorState(
      getMonitoringErrorMessage(pedidoAtivoQuery.error),
      pedidoAtivoQuery.refetch,
    );
  }

  const pedidoAtivo = pedidoAtivoQuery.data;

  return (
    <section className={DASHBOARD_CLASS_NAME}>
      <div className={MAP_PANEL_CLASS_NAME}>
        <MapCanvas
          pedidoAtivo={pedidoAtivo}
          currentFrame={currentFrame}
        />
      </div>

      <aside className={SIDEBAR_CLASS_NAME}>
        {renderHeader(pedidoAtivo)}
        <TelemetryGrid etaSegundos={pedidoAtivo.eta_segundos ?? null} />
        <StatusControl
          status={pedidoAtivo.status}
          pedidoId={pedidoId}
          onCancelar={handleCancelar}
          onEntregar={handleEntregar}
        />
        <ReplayTimeline />
      </aside>
    </section>
  );
}
