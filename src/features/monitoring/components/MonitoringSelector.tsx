import { useEffect, useMemo, type ReactElement } from "react";

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { listPedidos } from "@/api/pedidos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { HTTPValidationError, PedidoResponse } from "@/types/api";

const QUERY_KEY = ["monitoring-pedidos"];
const QUERY_LIMIT = 100;
const MONITORABLE_STATUSES = new Set(["calculado", "despachado"]);
const PAGE_CLASS_NAME =
  "flex min-h-[calc(100dvh-56px)] flex-col bg-background px-6 py-8";
const CONTENT_CLASS_NAME = "mx-auto flex w-full max-w-6xl flex-col gap-6";
const GRID_CLASS_NAME = "grid gap-4 md:grid-cols-2 xl:grid-cols-3";
const STATUS_CLASS_NAME: Record<string, string> = {
  calculado: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  despachado: "border-sky-500/30 bg-sky-500/10 text-sky-300",
};

function isValidationError(error: unknown): error is HTTPValidationError {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  return "detail" in error;
}

function getErrorMessage(error: unknown): string {
  if (isValidationError(error)) {
    return error.detail?.[0]?.msg ?? "Falha ao carregar pedidos para monitoramento.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Falha ao carregar pedidos para monitoramento.";
}

function isMonitorablePedido(pedido: PedidoResponse): boolean {
  return MONITORABLE_STATUSES.has(pedido.status);
}

function getPedidoDescription(pedido: PedidoResponse): string {
  if (pedido.descricao && pedido.descricao.trim().length > 0) {
    return pedido.descricao;
  }

  return "Pedido sem descricao operacional.";
}

function getPedidoStatusClassName(status: PedidoResponse["status"]): string {
  return STATUS_CLASS_NAME[status] ?? "border-border bg-muted text-muted-foreground";
}

function renderLoadingState(): ReactElement {
  return (
    <div className={GRID_CLASS_NAME}>
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton
          key={`monitoring-selector-skeleton-${index}`}
          className="h-40 rounded-xl"
        />
      ))}
    </div>
  );
}

function renderEmptyState(): ReactElement {
  return (
    <Card className="border border-border bg-card">
      <CardHeader>
        <CardTitle>Nenhum pedido pronto para monitoramento</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Assim que um pedido estiver com status calculado ou despachado, ele aparecera aqui.
        </p>
      </CardContent>
    </Card>
  );
}

function renderPedidoCard(
  pedido: PedidoResponse,
  onSelect: (pedidoId: number) => void,
): ReactElement {
  return (
    <Card key={pedido.id} className="border border-border bg-card">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg">Pedido #{pedido.id}</CardTitle>
          <Badge
            variant="outline"
            className={`rounded-md px-3 text-sm font-medium ${getPedidoStatusClassName(
              pedido.status,
            )}`}
          >
            {pedido.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>{getPedidoDescription(pedido)}</p>
          <p>Farmacia #{pedido.farmacia_id}</p>
        </div>
        <Button type="button" onClick={() => onSelect(pedido.id)}>
          Monitorar pedido
        </Button>
      </CardContent>
    </Card>
  );
}

export function MonitoringSelector(): ReactElement {
  const navigate = useNavigate();
  const pedidosQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => listPedidos({ limite: QUERY_LIMIT }),
    staleTime: 10_000,
    refetchInterval: false,
  });

  const monitorablePedidos = useMemo(() => {
    return (pedidosQuery.data?.pedidos ?? []).filter(isMonitorablePedido);
  }, [pedidosQuery.data?.pedidos]);

  useEffect(() => {
    if (!pedidosQuery.isError) {
      return;
    }

    toast.error(getErrorMessage(pedidosQuery.error));
  }, [pedidosQuery.error, pedidosQuery.isError]);

  function handleSelectPedido(pedidoId: number): void {
    navigate(`/monitoramento/${pedidoId}`);
  }

  return (
    <section className={PAGE_CLASS_NAME}>
      <div className={CONTENT_CLASS_NAME}>
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Selecionar pedido para monitoramento
          </h1>
          <p className="text-sm text-muted-foreground">
            Escolha um pedido calculado ou despachado para iniciar o acompanhamento em tempo real.
          </p>
        </header>

        {pedidosQuery.isLoading ? renderLoadingState() : null}

        {!pedidosQuery.isLoading && monitorablePedidos.length === 0
          ? renderEmptyState()
          : null}

        {!pedidosQuery.isLoading && monitorablePedidos.length > 0 ? (
          <div className={GRID_CLASS_NAME}>
            {monitorablePedidos.map((pedido) =>
              renderPedidoCard(pedido, handleSelectPedido),
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
