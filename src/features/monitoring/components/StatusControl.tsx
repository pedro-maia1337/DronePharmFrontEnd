import { useState, type ReactElement } from "react";

import { Lock } from "lucide-react";

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
import type { PedidoStatus } from "@/types/api";

import {
  canCancelPedido,
  getMonitoringBadgeClassName,
  hasFlightLock,
} from "../monitoringUtils";

const SECTION_CLASS_NAME =
  "flex flex-col gap-3 border-b border-[var(--surface-border)] px-5 py-[14px]";
const TITLE_CLASS_NAME =
  "text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]";
const LOCK_BLOCK_CLASS_NAME =
  "flex items-center gap-2 rounded-[var(--radius-md)] border border-[rgba(139,92,246,0.35)] bg-[var(--status-lock-bg)] px-[13px] py-[10px] text-[0.8125rem] text-[var(--status-lock)]";
const ACTION_ROW_CLASS_NAME = "flex flex-wrap gap-2";
const PRIMARY_BUTTON_CLASS_NAME =
  "h-[34px] rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 text-[var(--text-inverse)] hover:bg-[var(--accent-dim)]";
const GHOST_BUTTON_CLASS_NAME =
  "h-[34px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-transparent px-4 text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]";
const DANGER_BUTTON_CLASS_NAME =
  "h-[34px] rounded-[var(--radius-sm)] border border-[rgba(239,68,68,0.3)] bg-[var(--status-danger-bg)] px-4 text-[var(--status-danger)] hover:bg-[rgba(239,68,68,0.18)]";
const DISABLED_BUTTON_CLASS_NAME = "opacity-30";

interface StatusControlProps {
  status: PedidoStatus;
  pedidoId: number;
  replayEnabled?: boolean;
  replayVisible?: boolean;
  onCancelar: () => void;
  onEntregar: () => void;
  onToggleReplay?: () => void;
}

function getDisabledClassName(disabled: boolean): string | undefined {
  return disabled ? DISABLED_BUTTON_CLASS_NAME : undefined;
}

function shouldEnableManualDelivery(_status: PedidoStatus): boolean {
  return false;
}

function renderStatusBadge(status: PedidoStatus): ReactElement {
  const badgeClassName = getMonitoringBadgeClassName(status);

  return (
    <span className={`badge ${badgeClassName}`} translate="no">
      {status}
    </span>
  );
}

export function StatusControl({
  status,
  pedidoId,
  replayEnabled = false,
  replayVisible = false,
  onCancelar,
  onEntregar,
  onToggleReplay = () => {},
}: StatusControlProps): ReactElement {
  const [dialogOpen, setDialogOpen] = useState(false);
  const flightLocked = hasFlightLock(status);
  const canCancel = canCancelPedido(status);
  const canManualDeliver = shouldEnableManualDelivery(status);
  const canOpenReplay = replayEnabled;

  return (
    <>
      <section className={SECTION_CLASS_NAME} aria-label="Controle operacional">
        <div className={TITLE_CLASS_NAME}>Controle</div>
        {renderStatusBadge(status)}

        {flightLocked ? (
          <div className={LOCK_BLOCK_CLASS_NAME}>
            <Lock aria-hidden="true" className="size-4" />
            <div className="flex flex-col">
              <span className="font-medium">Operacao bloqueada durante voo</span>
              <span className="text-xs opacity-80">
                Aguardando conclusao da missao
              </span>
            </div>
          </div>
        ) : null}

        <div className={ACTION_ROW_CLASS_NAME}>
          <Button
            type="button"
            className={getDisabledClassName(!canManualDeliver) ?? PRIMARY_BUTTON_CLASS_NAME}
            disabled={!canManualDeliver}
            onClick={onEntregar}
          >
            Confirmar Entrega Manual
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                className={getDisabledClassName(!canCancel) ?? DANGER_BUTTON_CLASS_NAME}
                disabled={!canCancel}
              >
                Cancelar
              </Button>
            </DialogTrigger>
            <DialogContent className="border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]">
              <DialogHeader>
                <DialogTitle>Cancelar Pedido</DialogTitle>
                <DialogDescription className="text-[var(--text-secondary)]">
                  Confirme o cancelamento do pedido #{pedidoId}.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Fechar</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button
                    type="button"
                    className={DANGER_BUTTON_CLASS_NAME}
                    onClick={onCancelar}
                  >
                    Confirmar cancelamento
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            type="button"
            className={
              replayVisible
                ? PRIMARY_BUTTON_CLASS_NAME
                : `${GHOST_BUTTON_CLASS_NAME} ${getDisabledClassName(!canOpenReplay) ?? ""}`
            }
            disabled={!canOpenReplay}
            onClick={onToggleReplay}
          >
            Modo Replay
          </Button>
        </div>
      </section>

      <section className={SECTION_CLASS_NAME} aria-label="Estados do pedido">
        <div className={TITLE_CLASS_NAME}>Estados do Pedido</div>
        <div className="flex flex-wrap gap-2">
          <span className="badge bn">pendente</span>
          <span className="badge bi">calculado</span>
          <span className="badge bi">despachado</span>
          <span className="badge bk">em_voo</span>
          <span className="badge bo">entregue</span>
          <span className="badge bd">cancelado</span>
          <span className="badge bd">falha</span>
        </div>
      </section>
    </>
  );
}
