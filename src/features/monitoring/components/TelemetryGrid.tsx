import type { ReactElement } from "react";

import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatEta } from "@/lib/utils";
import type { TelemetriaResponse } from "@/types/api";

import { useTelemetryStore } from "../store/useTelemetryStore";

const BATTERY_ALERT_THRESHOLD = 0.2;
const METERS_UNIT = "m";
const KMH_UNIT = "km/h";
const PERCENT_UNIT = "%";
const WIND_UNIT = "m/s";
const EMPTY_VALUE = "--";
const MS_TO_KMH_FACTOR = 3.6;

interface TelemetryGridProps {
  etaSegundos: number | null;
}

interface MetricCardData {
  key: string;
  label: string;
  value: string;
  unit?: string;
  isBatteryAlert?: boolean;
}

function getElapsedSeconds(history: TelemetriaResponse[]): number {
  if (history.length < 2) {
    return 0;
  }

  const firstFrame = history[0];
  const lastFrame = history[history.length - 1];
  const firstTimestamp = new Date(firstFrame.criado_em).getTime();
  const lastTimestamp = new Date(lastFrame.criado_em).getTime();

  if (Number.isNaN(firstTimestamp) || Number.isNaN(lastTimestamp)) {
    return 0;
  }

  return Math.max(0, Math.floor((lastTimestamp - firstTimestamp) / 1000));
}

function formatMetricValue(value: number, fractionDigits = 0): string {
  return value.toFixed(fractionDigits);
}

function getVelocityValue(frame: TelemetriaResponse): string {
  return formatMetricValue(frame.velocidade_ms * MS_TO_KMH_FACTOR, 1);
}

function getAltitudeValue(frame: TelemetriaResponse): string {
  return formatMetricValue(frame.altitude_m);
}

function getBatteryValue(frame: TelemetriaResponse): string {
  return formatMetricValue(frame.bateria_pct * 100);
}

function getEtaValue(etaSegundos: number | null): string {
  if (etaSegundos === null) {
    return EMPTY_VALUE;
  }

  return formatEta(etaSegundos);
}

function getElapsedValue(history: TelemetriaResponse[]): string {
  return formatEta(getElapsedSeconds(history));
}

function getWindValue(frame: TelemetriaResponse): string {
  return formatMetricValue(frame.vento_ms, 1);
}

function buildMetricCards(
  currentFrame: TelemetriaResponse,
  history: TelemetriaResponse[],
  etaSegundos: number | null,
): MetricCardData[] {
  return [
    {
      key: "velocidade",
      label: "Velocidade",
      value: getVelocityValue(currentFrame),
      unit: KMH_UNIT,
    },
    {
      key: "altitude",
      label: "Altitude",
      value: getAltitudeValue(currentFrame),
      unit: METERS_UNIT,
    },
    {
      key: "bateria",
      label: "Bateria",
      value: getBatteryValue(currentFrame),
      unit: PERCENT_UNIT,
      isBatteryAlert: currentFrame.bateria_pct < BATTERY_ALERT_THRESHOLD,
    },
    {
      key: "eta",
      label: "ETA",
      value: getEtaValue(etaSegundos),
    },
    {
      key: "tempo-decorrido",
      label: "Tempo Decorrido",
      value: getElapsedValue(history),
    },
    {
      key: "vento",
      label: "Vento",
      value: getWindValue(currentFrame),
      unit: WIND_UNIT,
    },
  ];
}

function renderSkeletonCards(): ReactElement[] {
  return Array.from({ length: 6 }, (_, index) => (
    <Card
      key={`telemetry-skeleton-${index}`}
      size="sm"
      className="border border-border bg-card"
    >
      <CardHeader className="gap-2">
        <Skeleton className="h-3 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-28" />
      </CardContent>
    </Card>
  ));
}

function getMetricCardClassName(card: MetricCardData): string {
  if (card.isBatteryAlert) {
    return "border border-destructive/60 bg-destructive/10";
  }

  return "border border-border bg-card";
}

function renderMetricCardIcon(card: MetricCardData): ReactElement | null {
  if (!card.isBatteryAlert) {
    return null;
  }

  return <AlertTriangle className="size-3.5 text-destructive" />;
}

function renderMetricCardUnit(card: MetricCardData): ReactElement | null {
  if (!card.unit) {
    return null;
  }

  return (
    <span className="ml-1 text-sm font-normal text-muted-foreground">
      {card.unit}
    </span>
  );
}

function renderMetricCard(card: MetricCardData): ReactElement {
  return (
    <Card key={card.key} size="sm" className={getMetricCardClassName(card)}>
      <CardHeader className="gap-2">
        <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
          {renderMetricCardIcon(card)}
          {card.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
          {card.value}
          {renderMetricCardUnit(card)}
        </p>
      </CardContent>
    </Card>
  );
}

export function TelemetryGrid({
  etaSegundos,
}: TelemetryGridProps): ReactElement {
  const currentFrame = useTelemetryStore((state) => state.currentFrame);
  const history = useTelemetryStore((state) => state.history);

  if (currentFrame === null) {
    return <div className="grid grid-cols-2 gap-4">{renderSkeletonCards()}</div>;
  }

  const cards = buildMetricCards(currentFrame, history, etaSegundos);

  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map((card) => renderMetricCard(card))}
    </div>
  );
}
