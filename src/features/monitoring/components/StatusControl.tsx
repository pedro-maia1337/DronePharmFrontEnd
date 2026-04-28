import { useState, type ReactElement } from "react";

import { Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PedidoStatus } from "@/types/api";

const FLIGHT_LOCK_MESSAGE = "Operacao bloqueada durante voo";
const CANCEL_DIALOG_TITLE = "Cancelar pedido";
const CANCEL_DIALOG_DESCRIPTION =
  "Tem certeza de que deseja cancelar este pedido? Essa acao nao pode ser desfeita.";
const CANCEL_BUTTON_LABEL = "Cancelar Pedido";
const DELIVER_BUTTON_LABEL = "Confirmar Entrega Manual";
const CANCEL_CONFIRM_LABEL = "Confirmar cancelamento";
const CLOSE_BUTTON_LABEL = "Fechar";

interface StatusControlProps {
  status: PedidoStatus;
  pedidoId: number;
  onCancelar: () => void;
  onEntregar: () => void;
}

interface StatusBadgeConfig {
  label: string;
  className: string;
}

function getStatusBadgeConfig(status: PedidoStatus): StatusBadgeConfig | null {
  switch (status) {
    case "pendente":
      return {
        label: "Pendente",
        className: "border-border bg-muted text-muted-foreground",
      };
    case "despachado":
      return {
        label: "Despachado",
        className: "border-sky-500/30 bg-sky-500/10 text-sky-300",
      };
    case "entregue":
      return {
        label: "Entregue \u2713",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      };
    case "cancelado":
      return {
        label: "Cancelado",
        className: "border-destructive/40 bg-destructive/10 text-destructive",
      };
    case "falha":
      return {
        label: "Falha",
        className: "border-orange-500/30 bg-orange-500/10 text-orange-300",
      };
    default:
      return null;
  }
}

function shouldShowCancelAction(status: PedidoStatus): boolean {
  return status === "pendente" || status === "calculado";
}

function shouldShowManualDeliveryAction(status: PedidoStatus): boolean {
  return status === "em_voo";
}

function renderStatusBadge(status: PedidoStatus): ReactElement | null {
  const badgeConfig = getStatusBadgeConfig(status);

  if (badgeConfig === null) {
    return null;
  }

  return (
    <Badge
      variant="outline"
      className={`h-7 rounded-md px-3 text-sm font-medium ${badgeConfig.className}`}
    >
      {badgeConfig.label}
    </Badge>
  );
}

function renderCancelDialogContent(
  pedidoId: number,
  onConfirm: () => void,
): ReactElement {
  return (
    <DialogContent className="border border-border bg-popover text-popover-foreground">
      <DialogHeader>
        <DialogTitle>{CANCEL_DIALOG_TITLE}</DialogTitle>
        <DialogDescription>
          {CANCEL_DIALOG_DESCRIPTION} Pedido #{pedidoId}.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="border-border bg-muted/40">
        <DialogClose asChild>
          <Button variant="outline">{CLOSE_BUTTON_LABEL}</Button>
        </DialogClose>
        <DialogClose asChild>
          <Button variant="destructive" onClick={onConfirm}>
            {CANCEL_CONFIRM_LABEL}
          </Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
}

function renderFlightLock(): ReactElement {
  return (
    <div className="flex items-center gap-2 rounded-md border border-sky-400/40 bg-sky-500/10 px-4 py-3 text-sm text-sky-300">
      <Lock className="size-4" />
      <span>{FLIGHT_LOCK_MESSAGE}</span>
    </div>
  );
}

function renderLockedManualButton(): ReactElement {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              type="button"
              disabled
              className="pointer-events-none opacity-35"
            >
              {DELIVER_BUTTON_LABEL}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent sideOffset={8}>{FLIGHT_LOCK_MESSAGE}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function StatusControl({
  status,
  pedidoId,
  onCancelar,
  onEntregar: _onEntregar,
}: StatusControlProps): ReactElement {
  void _onEntregar;

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const statusBadge = renderStatusBadge(status);
  const showCancelAction = shouldShowCancelAction(status);
  const showManualDeliveryAction = shouldShowManualDeliveryAction(status);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      {statusBadge}

      {showCancelAction ? (
        <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">{CANCEL_BUTTON_LABEL}</Button>
          </DialogTrigger>
          {renderCancelDialogContent(pedidoId, () => {
            setIsCancelDialogOpen(false);
            onCancelar();
          })}
        </Dialog>
      ) : null}

      {showManualDeliveryAction ? (
        <>
          {renderFlightLock()}
          {renderLockedManualButton()}
        </>
      ) : null}
    </div>
  );
}
