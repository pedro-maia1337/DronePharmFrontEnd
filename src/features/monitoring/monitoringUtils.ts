import type {
  PedidoAtivoResponse,
  PedidoResponse,
  PedidoResumoTrackingResponse,
  PedidoStatus,
  PosicaoAtualResponse,
  TelemetriaResponse,
  WaypointResponse,
} from "@/types/api";

const PENDING_STATUSES: PedidoStatus[] = ["pendente", "calculado"];
const EARTH_RADIUS_METERS = 6_371_000;
const PERCENT_MULTIPLIER = 100;
const MILLISECONDS_PER_SECOND = 1000;
const HEARTBEAT_TIMEOUT_SECONDS = 10;

export interface MonitoringSnapshot {
  pedidoId: number;
  status: PedidoStatus;
  pedido: PedidoResumoTrackingResponse;
  destination: [number, number] | null;
  positionSnapshot: PosicaoAtualResponse | null;
  routePoints: [number, number][];
  etaSegundos: number | null;
  tempoDecorridoSegundos: number | null;
  estimativaEntregaEm: string | null;
  despachadoEm: string | null;
  criadoEm: string | null;
  droneId: string;
}

export interface Posicao {
  lat: number;
  lng: number;
}

export interface Vetor {
  velocidade_ms: number;
  direcao: number;
}

export type StatusMissao = "em_voo" | "aguardando" | "emergencia";

export interface DroneMonitoramento {
  drone_id: string;
  pedido_id: number;
  status_pedido: PedidoStatus;
  posicao: Posicao;
  vetor: Vetor;
  status_missao: StatusMissao;
  eta_segundos: number | null;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function getPedidoResumo(
  pedidoAtivo: PedidoAtivoResponse | null,
  pedido: PedidoResponse | null,
): PedidoResumoTrackingResponse {
  if (pedidoAtivo !== null) {
    return pedidoAtivo.pedido;
  }

  return {
    prioridade: pedido?.prioridade ?? 2,
    descricao: pedido?.descricao ?? null,
    farmacia_id: pedido?.farmacia_id ?? 0,
    janela_fim: pedido?.janela_fim ?? null,
  };
}

function getDestination(
  pedidoAtivo: PedidoAtivoResponse | null,
  pedido: PedidoResponse | null,
): [number, number] | null {
  if (pedidoAtivo?.destino !== undefined) {
    return [pedidoAtivo.destino.latitude, pedidoAtivo.destino.longitude];
  }

  if (pedido === null) {
    return null;
  }

  return [pedido.latitude, pedido.longitude];
}

function getRoutePoints(
  pedidoAtivo: PedidoAtivoResponse | null,
): [number, number][] {
  const waypoints = pedidoAtivo?.rota?.waypoints ?? [];

  return waypoints.map((waypoint: WaypointResponse) => [
    waypoint.latitude,
    waypoint.longitude,
  ]);
}

function getHaversineDistance(
  from: [number, number],
  to: [number, number],
): number {
  const [fromLat, fromLng] = from;
  const [toLat, toLng] = to;
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLng = toRadians(toLng - fromLng);
  const fromLatRad = toRadians(fromLat);
  const toLatRad = toRadians(toLat);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLatRad) * Math.cos(toLatRad) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getPolylineDistance(points: [number, number][]): number {
  let distance = 0;

  for (let index = 1; index < points.length; index += 1) {
    distance += getHaversineDistance(points[index - 1], points[index]);
  }

  return distance;
}

function getRemainingRouteDistanceMeters(
  routePoints: [number, number][],
  currentPosition: [number, number],
): number | null {
  if (routePoints.length < 2) {
    return null;
  }

  const totalDistance = getPolylineDistance(routePoints);

  if (totalDistance <= 0) {
    return null;
  }

  const traveledDistance = getClosestDistanceAlongRoute(
    routePoints,
    currentPosition,
  );

  return Math.max(totalDistance - traveledDistance, 0);
}

function getClosestDistanceAlongRoute(
  routePoints: [number, number][],
  currentPosition: [number, number],
): number {
  if (routePoints.length < 2) {
    return 0;
  }

  let traveledDistance = 0;
  let closestDistance = Number.POSITIVE_INFINITY;
  let distanceAtClosestPoint = 0;

  for (let index = 1; index < routePoints.length; index += 1) {
    const segmentStart = routePoints[index - 1];
    const segmentEnd = routePoints[index];
    const distanceToStart = getHaversineDistance(currentPosition, segmentStart);
    const distanceToEnd = getHaversineDistance(currentPosition, segmentEnd);
    const segmentDistance = getHaversineDistance(segmentStart, segmentEnd);
    const segmentClosestDistance = Math.min(distanceToStart, distanceToEnd);

    if (segmentClosestDistance < closestDistance) {
      closestDistance = segmentClosestDistance;
      distanceAtClosestPoint =
        traveledDistance +
        (distanceToStart <= distanceToEnd ? 0 : segmentDistance);
    }

    traveledDistance += segmentDistance;
  }

  return distanceAtClosestPoint;
}

export function isPedidoSelectable(status: PedidoStatus): boolean {
  return PENDING_STATUSES.includes(status);
}

export function getMonitoringBadgeClassName(status: PedidoStatus): string {
  switch (status) {
    case "calculado":
    case "despachado":
      return "bi";
    case "em_voo":
      return "bk";
    case "entregue":
      return "bo";
    case "cancelado":
    case "falha":
      return "bd";
    case "pendente":
    default:
      return "bn";
  }
}

export function hasFlightLock(status: PedidoStatus): boolean {
  return status === "em_voo";
}

export function canCancelPedido(status: PedidoStatus): boolean {
  return status === "pendente" || status === "calculado";
}

export function canReplayTelemetry(historyLength: number): boolean {
  return historyLength > 0;
}

export function buildMonitoringSnapshot(
  pedidoAtivo: PedidoAtivoResponse | null,
  pedido: PedidoResponse | null,
): MonitoringSnapshot | null {
  if (pedidoAtivo === null && pedido === null) {
    return null;
  }

  return {
    pedidoId: pedidoAtivo?.pedido_id ?? pedido?.id ?? 0,
    status: pedidoAtivo?.status ?? pedido?.status ?? "pendente",
    pedido: getPedidoResumo(pedidoAtivo, pedido),
    destination: getDestination(pedidoAtivo, pedido),
    positionSnapshot: pedidoAtivo?.posicao_atual ?? null,
    routePoints: getRoutePoints(pedidoAtivo),
    etaSegundos:
      pedidoAtivo?.eta_segundos ?? pedidoAtivo?.tempo_restante_seg ?? null,
    tempoDecorridoSegundos:
      pedidoAtivo?.tempo_decorrido_s ?? pedidoAtivo?.tempo_decorrido_seg ?? null,
    estimativaEntregaEm: pedidoAtivo?.estimativa_entrega_em ?? null,
    despachadoEm: pedidoAtivo?.despachado_em ?? pedido?.despachado_em ?? null,
    criadoEm: pedidoAtivo?.criado_em ?? pedido?.criado_em ?? null,
    droneId: pedidoAtivo?.drone?.id ?? pedidoAtivo?.drone_id ?? "",
  };
}

export function getRouteProgress(
  routePoints: [number, number][],
  currentPosition: [number, number] | null,
): number | null {
  if (routePoints.length < 2 || currentPosition === null) {
    return null;
  }

  const totalDistance = getPolylineDistance(routePoints);

  if (totalDistance <= 0) {
    return null;
  }

  const traveledDistance = getClosestDistanceAlongRoute(
    routePoints,
    currentPosition,
  );

  return Math.round((traveledDistance / totalDistance) * PERCENT_MULTIPLIER);
}

export function getEffectiveEtaSegundos(
  etaSegundos: number | null,
  routePoints: [number, number][],
  currentPosition: [number, number] | null,
  destination: [number, number] | null,
  velocidadeMs: number | null,
): number | null {
  if (etaSegundos !== null) {
    return etaSegundos;
  }

  if (velocidadeMs === null || velocidadeMs <= 0 || currentPosition === null) {
    return null;
  }

  const remainingRouteDistanceMeters = getRemainingRouteDistanceMeters(
    routePoints,
    currentPosition,
  );

  const distanceMeters =
    remainingRouteDistanceMeters ??
    (destination !== null
      ? getHaversineDistance(currentPosition, destination)
      : null);

  if (distanceMeters === null) {
    return null;
  }

  return Math.round(distanceMeters / velocidadeMs);
}

export function isSignalLost(
  currentFrame: TelemetriaResponse | null,
  positionSnapshot: PosicaoAtualResponse | null,
  nowTimestamp: number,
): boolean {
  const referenceTimestamp =
    currentFrame?.criado_em ?? positionSnapshot?.atualizado_em ?? null;

  if (referenceTimestamp === null) {
    return false;
  }

  const parsedTimestamp = Date.parse(referenceTimestamp);

  if (Number.isNaN(parsedTimestamp)) {
    return false;
  }

  return (
    nowTimestamp - parsedTimestamp >
    HEARTBEAT_TIMEOUT_SECONDS * MILLISECONDS_PER_SECOND
  );
}

function getMissionStatus(
  monitoringSnapshot: MonitoringSnapshot,
  currentFrame: TelemetriaResponse | null,
): StatusMissao {
  if (monitoringSnapshot.status === "em_voo" || currentFrame?.status === "em_voo") {
    return "em_voo";
  }

  if (currentFrame?.status === "emergencia") {
    return "emergencia";
  }

  return "aguardando";
}

export function buildDroneMonitoramento(
  monitoringSnapshot: MonitoringSnapshot | null,
  currentFrame: TelemetriaResponse | null,
): DroneMonitoramento | null {
  if (monitoringSnapshot === null) {
    return null;
  }

  const latitude =
    currentFrame?.latitude ?? monitoringSnapshot.positionSnapshot?.latitude;
  const longitude =
    currentFrame?.longitude ?? monitoringSnapshot.positionSnapshot?.longitude;

  if (latitude === null || latitude === undefined) {
    return null;
  }

  if (longitude === null || longitude === undefined) {
    return null;
  }

  return {
    drone_id: monitoringSnapshot.droneId,
    pedido_id: monitoringSnapshot.pedidoId,
    status_pedido: monitoringSnapshot.status,
    posicao: {
      lat: latitude,
      lng: longitude,
    },
    vetor: {
      velocidade_ms: currentFrame?.velocidade_ms ?? 0,
      direcao: currentFrame?.direcao_vento ?? 0,
    },
    status_missao: getMissionStatus(monitoringSnapshot, currentFrame),
    eta_segundos: monitoringSnapshot.etaSegundos,
  };
}
