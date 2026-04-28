import type { ReactElement } from "react";

import { AlertTriangle } from "lucide-react";

import { formatEta } from "@/lib/utils";
import type { PosicaoAtualResponse, TelemetriaResponse } from "@/types/api";

import { useTelemetryStore } from "../store/useTelemetryStore";

const BATTERY_ALERT_THRESHOLD = 0.2;
const KMH_FACTOR = 3.6;
const EMPTY_VALUE = "--";
const GRID_CLASS_NAME = "grid grid-cols-2 gap-[7px]";
const CARD_CLASS_NAME =
  "rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-card)] px-[13px] py-[11px] shadow-[var(--shadow-card)]";
const ALERT_CARD_CLASS_NAME =
  "border-[var(--status-danger)] bg-[rgba(239,68,68,0.06)]";
const ACCENT_CARD_CLASS_NAME =
  "border-[var(--surface-border)] bg-[var(--surface-card)] [&_.metric-value]:text-[var(--accent)]";
const LABEL_CLASS_NAME =
  "mb-[5px] flex items-center gap-[5px] text-[0.6875rem] uppercase tracking-[0.06em] text-[var(--text-secondary)]";
const VALUE_CLASS_NAME =
  "metric-value font-[var(--font-data)] text-[1.4375rem] leading-none tabular-nums text-[var(--text-primary)]";
const UNIT_CLASS_NAME =
  "ml-1 font-sans text-xs text-[var(--text-muted)] not-italic";

interface TelemetryGridProps {
  etaSegundos: number | null;
  progressPct: number | null;
  connected: boolean;
  positionSnapshot: PosicaoAtualResponse | null;
}

interface MetricCard {
  key: string;
  label: string;
  value: string;
  unit?: string;
  variant?: "default" | "alert" | "accent";
}

function formatNumber(value: number, fractionDigits = 0): string {
  return value.toFixed(fractionDigits);
}

function formatPercent(value: number): string {
  return formatNumber(value * 100);
}

function getSignalValue(connected: boolean, historyLength: number): string {
  if (connected) {
    return "Ao vivo";
  }

  if (historyLength > 0) {
    return "Replay";
  }

  return "Offline";
}

function getAltitudeValue(
  currentFrame: TelemetriaResponse | null,
  positionSnapshot: PosicaoAtualResponse | null,
): string {
  const altitude = currentFrame?.altitude_m ?? positionSnapshot?.altitude_m;

  if (altitude === null || altitude === undefined) {
    return EMPTY_VALUE;
  }

  return formatNumber(altitude);
}

function getVelocityValue(currentFrame: TelemetriaResponse | null): string {
  if (currentFrame === null) {
    return EMPTY_VALUE;
  }

  return formatNumber(currentFrame.velocidade_ms * KMH_FACTOR, 0);
}

function getBatteryValue(currentFrame: TelemetriaResponse | null): string {
  if (currentFrame === null) {
    return EMPTY_VALUE;
  }

  return formatPercent(currentFrame.bateria_pct);
}

function getEtaValue(etaSegundos: number | null): string {
  if (etaSegundos === null) {
    return EMPTY_VALUE;
  }

  return formatEta(etaSegundos);
}

function getProgressValue(progressPct: number | null): string {
  if (progressPct === null) {
    return EMPTY_VALUE;
  }

  return String(progressPct);
}

function getCardClassName(card: MetricCard): string {
  if (card.variant === "alert") {
    return `${CARD_CLASS_NAME} ${ALERT_CARD_CLASS_NAME}`;
  }

  if (card.variant === "accent") {
    return `${CARD_CLASS_NAME} ${ACCENT_CARD_CLASS_NAME}`;
  }

  return CARD_CLASS_NAME;
}

function renderAlertIcon(card: MetricCard): ReactElement | null {
  if (card.variant !== "alert") {
    return null;
  }

  return (
    <AlertTriangle
      aria-hidden="true"
      className="size-3 text-[var(--status-danger)]"
    />
  );
}

function renderUnit(unit?: string): ReactElement | null {
  if (unit === undefined) {
    return null;
  }

  return <span className={UNIT_CLASS_NAME}>{unit}</span>;
}

function buildMetricCards(
  currentFrame: TelemetriaResponse | null,
  positionSnapshot: PosicaoAtualResponse | null,
  connected: boolean,
  historyLength: number,
  etaSegundos: number | null,
  progressPct: number | null,
): MetricCard[] {
  return [
    {
      key: "velocidade",
      label: "Velocidade",
      value: getVelocityValue(currentFrame),
      unit: "km/h",
    },
    {
      key: "altura",
      label: "Altura",
      value: getAltitudeValue(currentFrame, positionSnapshot),
      unit: "m",
    },
    {
      key: "bateria",
      label: "Bateria",
      value: getBatteryValue(currentFrame),
      unit: "%",
      variant:
        currentFrame !== null && currentFrame.bateria_pct < BATTERY_ALERT_THRESHOLD
          ? "alert"
          : "default",
    },
    {
      key: "eta",
      label: "ETA",
      value: getEtaValue(etaSegundos),
      variant: "accent",
    },
    {
      key: "sinal",
      label: "Sinal",
      value: getSignalValue(connected, historyLength),
    },
    {
      key: "progresso",
      label: "Progresso",
      value: getProgressValue(progressPct),
      unit: "%",
    },
  ];
}

export function TelemetryGrid({
  etaSegundos,
  progressPct,
  connected,
  positionSnapshot,
}: TelemetryGridProps): ReactElement {
  const currentFrame = useTelemetryStore((state) => state.currentFrame);
  const historyLength = useTelemetryStore((state) => state.history.length);
  const cards = buildMetricCards(
    currentFrame,
    positionSnapshot,
    connected,
    historyLength,
    etaSegundos,
    progressPct,
  );

  return (
    <section aria-label="Telemetria" className="flex flex-col gap-[10px]">
      <div className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
        Telemetria
      </div>
      <div className={GRID_CLASS_NAME}>
        {cards.map((card) => (
          <article key={card.key} className={getCardClassName(card)}>
            <div className={LABEL_CLASS_NAME}>
              {renderAlertIcon(card)}
              {card.label}
            </div>
            <div className={VALUE_CLASS_NAME}>
              {card.value}
              {renderUnit(card.unit)}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
