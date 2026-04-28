import { useEffect, useMemo, useRef, type ReactElement } from "react";

import L, { type DivIcon, type LatLngExpression } from "leaflet";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";

import { calcBearing } from "@/lib/utils";
import type {
  PedidoAtivoResponse,
  TelemetriaResponse,
  WaypointResponse,
} from "@/types/api";

const MAP_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const ROUTE_COLOR = "#00FF9C";
const DESTINATION_COLOR = "#FACC15";
const DESTINATION_RADIUS_METERS = 15;
const DEFAULT_ZOOM = 15;
const DRONE_ICON_SIZE = 24;
const DESTINATION_ICON_SIZE = 16;
const FIT_BOUNDS_PADDING: [number, number] = [32, 32];
const FULL_CIRCLE_DEGREES = 360;
const ZERO_BEARING = 0;
const MAP_CLASS_NAME = "h-full w-full rounded-xl";
const MAP_WRAPPER_CLASS_NAME =
  "h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-border bg-card";

interface MapCanvasProps {
  pedidoAtivo: PedidoAtivoResponse;
  currentFrame: TelemetriaResponse | null;
}

interface FitBoundsControllerProps {
  points: [number, number][];
}

function waypointToLatLng(w: WaypointResponse): [number, number] {
  return [w.latitude, w.longitude];
}

function getWaypointPositions(pedidoAtivo: PedidoAtivoResponse): [number, number][] {
  const waypoints = pedidoAtivo.rota?.waypoints ?? [];

  return waypoints.map(waypointToLatLng);
}

function getLastWaypointPosition(
  waypointPositions: [number, number][],
): [number, number] | null {
  if (waypointPositions.length === 0) {
    return null;
  }

  return waypointPositions[waypointPositions.length - 1];
}

function getDronePosition(
  currentFrame: TelemetriaResponse | null,
): [number, number] | null {
  if (currentFrame === null) {
    return null;
  }

  return [currentFrame.latitude, currentFrame.longitude];
}

function getFallbackCenter(pedidoAtivo: PedidoAtivoResponse): [number, number] {
  return [pedidoAtivo.destino.latitude, pedidoAtivo.destino.longitude];
}

function getMapCenter(
  pedidoAtivo: PedidoAtivoResponse,
  waypointPositions: [number, number][],
  currentFrame: TelemetriaResponse | null,
): [number, number] {
  const dronePosition = getDronePosition(currentFrame);

  if (dronePosition !== null) {
    return dronePosition;
  }

  const lastWaypointPosition = getLastWaypointPosition(waypointPositions);

  if (lastWaypointPosition !== null) {
    return lastWaypointPosition;
  }

  return getFallbackCenter(pedidoAtivo);
}

function createDroneIconHtml(bearing: number): string {
  return `
    <div style="width:${DRONE_ICON_SIZE}px;height:${DRONE_ICON_SIZE}px;transform:rotate(${bearing}deg);transform-origin:center center;display:flex;align-items:center;justify-content:center;">
      <svg width="${DRONE_ICON_SIZE}" height="${DRONE_ICON_SIZE}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M12 2L21 22L12 17L3 22L12 2Z" fill="${ROUTE_COLOR}" />
      </svg>
    </div>
  `;
}

function createDestinationIconHtml(): string {
  return `
    <div style="width:${DESTINATION_ICON_SIZE}px;height:${DESTINATION_ICON_SIZE}px;border-radius:9999px;background:${DESTINATION_COLOR};box-shadow:0 0 0 2px rgba(250,204,21,0.25);"></div>
  `;
}

function createDroneIcon(bearing: number): DivIcon {
  return L.divIcon({
    className: "",
    html: createDroneIconHtml(bearing),
    iconSize: [DRONE_ICON_SIZE, DRONE_ICON_SIZE],
    iconAnchor: [DRONE_ICON_SIZE / 2, DRONE_ICON_SIZE / 2],
  });
}

function createDestinationIcon(): DivIcon {
  return L.divIcon({
    className: "",
    html: createDestinationIconHtml(),
    iconSize: [DESTINATION_ICON_SIZE, DESTINATION_ICON_SIZE],
    iconAnchor: [DESTINATION_ICON_SIZE / 2, DESTINATION_ICON_SIZE / 2],
  });
}

const DESTINATION_ICON = createDestinationIcon();

function getNormalizedBearing(previous: [number, number], next: [number, number]): number {
  const bearing = calcBearing(previous, next);

  if (!Number.isFinite(bearing)) {
    return ZERO_BEARING;
  }

  return (bearing + FULL_CIRCLE_DEGREES) % FULL_CIRCLE_DEGREES;
}

function getPointsSignature(points: [number, number][]): string {
  return points.map((point) => point.join(",")).join("|");
}

function FitBoundsController({
  points,
}: FitBoundsControllerProps): ReactElement | null {
  const map = useMap();
  const previousSignatureRef = useRef<string>("");

  useEffect(() => {
    if (points.length === 0) {
      return;
    }

    const pointsSignature = getPointsSignature(points);

    if (previousSignatureRef.current === pointsSignature) {
      return;
    }

    previousSignatureRef.current = pointsSignature;

    const bounds = L.latLngBounds(points as LatLngExpression[]);

    map.fitBounds(bounds, { padding: FIT_BOUNDS_PADDING });
  }, [map, points]);

  return null;
}

export function MapCanvas({
  pedidoAtivo,
  currentFrame,
}: MapCanvasProps): ReactElement {
  const previousDronePositionRef = useRef<[number, number] | null>(null);
  const waypointPositions = useMemo(
    () => getWaypointPositions(pedidoAtivo),
    [pedidoAtivo],
  );
  const dronePosition = getDronePosition(currentFrame);
  const lastWaypointPosition = getLastWaypointPosition(waypointPositions);
  const mapCenter = getMapCenter(pedidoAtivo, waypointPositions, currentFrame);
  const bearing = useMemo(() => {
    const previousDronePosition = previousDronePositionRef.current;

    if (previousDronePosition === null || dronePosition === null) {
      return ZERO_BEARING;
    }

    return getNormalizedBearing(previousDronePosition, dronePosition);
  }, [dronePosition]);
  const droneIcon = useMemo(() => createDroneIcon(bearing), [bearing]);

  useEffect(() => {
    previousDronePositionRef.current = dronePosition;
  }, [dronePosition]);

  return (
    <div className={MAP_WRAPPER_CLASS_NAME}>
      <MapContainer
        center={mapCenter}
        zoom={DEFAULT_ZOOM}
        className={MAP_CLASS_NAME}
        scrollWheelZoom
      >
        <TileLayer attribution={MAP_ATTRIBUTION} url={MAP_TILE_URL} />
        <FitBoundsController points={waypointPositions} />
        <Polyline positions={waypointPositions} pathOptions={{ color: ROUTE_COLOR, weight: 3 }} />
        {lastWaypointPosition !== null ? (
          <>
            <Marker position={lastWaypointPosition} icon={DESTINATION_ICON} />
            <Circle
              center={lastWaypointPosition}
              radius={DESTINATION_RADIUS_METERS}
              pathOptions={{ color: DESTINATION_COLOR }}
            />
          </>
        ) : null}
        {dronePosition !== null ? (
          <Marker position={dronePosition} icon={droneIcon} />
        ) : null}
      </MapContainer>
    </div>
  );
}
