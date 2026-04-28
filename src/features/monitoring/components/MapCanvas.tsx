import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";

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
import type { PosicaoAtualResponse, TelemetriaResponse } from "@/types/api";

const MAP_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const ROUTE_COLOR = "#00ff9c";
const DESTINATION_COLOR = "#f59e0b";
const ORIGIN_COLOR = "#3b82f6";
const DEFAULT_CENTER: [number, number] = [-19.932, -43.9408];
const DEFAULT_ZOOM = 15;
const DESTINATION_RADIUS_METERS = 18;
const FIT_BOUNDS_PADDING: [number, number] = [32, 32];
const MAP_WRAPPER_CLASS_NAME =
  "relative h-full min-h-[420px] w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[#080c11]";
const MAP_CLASS_NAME = "h-full w-full";
const MAP_LABEL_CLASS_NAME =
  "pointer-events-none absolute bottom-5 left-5 z-[500] rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-card)] px-3 py-1 font-mono text-[11px] text-[var(--text-muted)]";

interface MapCanvasProps {
  routePoints: [number, number][];
  destination: [number, number] | null;
  currentFrame: TelemetriaResponse | null;
  positionSnapshot: PosicaoAtualResponse | null;
}

interface FitBoundsControllerProps {
  points: [number, number][];
}

function createDroneIconHtml(bearing: number): string {
  return `
    <div style="width:24px;height:24px;transform:rotate(${bearing}deg);transform-origin:center center;display:flex;align-items:center;justify-content:center;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M12 2L21 22L12 17L3 22L12 2Z" fill="${ROUTE_COLOR}" />
      </svg>
    </div>
  `;
}

function createStaticIcon(color: string, size: number): DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};box-shadow:0 0 0 2px color-mix(in srgb, ${color} 30%, transparent);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createDroneIcon(bearing: number): DivIcon {
  return L.divIcon({
    className: "",
    html: createDroneIconHtml(bearing),
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function getPointsSignature(points: [number, number][]): string {
  return points.map((point) => point.join(",")).join("|");
}

function getFallbackPosition(
  positionSnapshot: PosicaoAtualResponse | null,
): [number, number] | null {
  if (
    positionSnapshot?.latitude === null ||
    positionSnapshot?.latitude === undefined ||
    positionSnapshot?.longitude === null ||
    positionSnapshot?.longitude === undefined
  ) {
    return null;
  }

  return [positionSnapshot.latitude, positionSnapshot.longitude];
}

function getDronePosition(
  currentFrame: TelemetriaResponse | null,
  positionSnapshot: PosicaoAtualResponse | null,
): [number, number] | null {
  if (currentFrame !== null) {
    return [currentFrame.latitude, currentFrame.longitude];
  }

  return getFallbackPosition(positionSnapshot);
}

function getMapCenter(
  routePoints: [number, number][],
  destination: [number, number] | null,
  dronePosition: [number, number] | null,
): [number, number] {
  if (dronePosition !== null) {
    return dronePosition;
  }

  if (routePoints.length > 0) {
    return routePoints[0];
  }

  if (destination !== null) {
    return destination;
  }

  return DEFAULT_CENTER;
}

function getMapLabel(
  currentFrame: TelemetriaResponse | null,
  positionSnapshot: PosicaoAtualResponse | null,
): string {
  const latitude = currentFrame?.latitude ?? positionSnapshot?.latitude ?? null;
  const longitude =
    currentFrame?.longitude ?? positionSnapshot?.longitude ?? null;
  const altitude =
    currentFrame?.altitude_m ?? positionSnapshot?.altitude_m ?? null;

  if (latitude === null || longitude === null) {
    return "Aguardando posicao do drone";
  }

  const altitudeLabel = altitude === null ? "--" : altitude.toFixed(0);

  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)} · alt ${altitudeLabel}m`;
}

function getBearing(
  previousDronePosition: [number, number] | null,
  dronePosition: [number, number] | null,
): number {
  if (previousDronePosition === null || dronePosition === null) {
    return 0;
  }

  return calcBearing(previousDronePosition, dronePosition);
}

function FitBoundsController({
  points,
}: FitBoundsControllerProps): ReactElement | null {
  const map = useMap();
  const previousSignatureRef = useRef("");

  useEffect(() => {
    if (points.length === 0) {
      return;
    }

    const pointsSignature = getPointsSignature(points);

    if (pointsSignature === previousSignatureRef.current) {
      return;
    }

    previousSignatureRef.current = pointsSignature;
    map.fitBounds(L.latLngBounds(points as LatLngExpression[]), {
      padding: FIT_BOUNDS_PADDING,
    });
  }, [map, points]);

  return null;
}

const DESTINATION_ICON = createStaticIcon(DESTINATION_COLOR, 16);
const ORIGIN_ICON = createStaticIcon(ORIGIN_COLOR, 12);

export function MapCanvas({
  routePoints,
  destination,
  currentFrame,
  positionSnapshot,
}: MapCanvasProps): ReactElement {
  const previousDronePositionRef = useRef<[number, number] | null>(null);
  const [bearing, setBearing] = useState(0);
  const dronePosition = getDronePosition(currentFrame, positionSnapshot);
  const mapCenter = getMapCenter(routePoints, destination, dronePosition);
  const overlayPoints = useMemo(() => {
    const points = [...routePoints];

    if (dronePosition !== null) {
      points.push(dronePosition);
    }

    if (destination !== null) {
      points.push(destination);
    }

    return points;
  }, [destination, dronePosition, routePoints]);
  const droneIcon = useMemo(() => createDroneIcon(bearing), [bearing]);
  const mapLabel = getMapLabel(currentFrame, positionSnapshot);

  useEffect(() => {
    setBearing(getBearing(previousDronePositionRef.current, dronePosition));
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
        <FitBoundsController points={overlayPoints} />
        {routePoints.length > 1 ? (
          <Polyline
            positions={routePoints}
            pathOptions={{ color: ROUTE_COLOR, weight: 3, opacity: 0.9 }}
          />
        ) : null}
        {routePoints[0] !== undefined ? (
          <Marker position={routePoints[0]} icon={ORIGIN_ICON} />
        ) : null}
        {destination !== null ? (
          <>
            <Marker position={destination} icon={DESTINATION_ICON} />
            <Circle
              center={destination}
              radius={DESTINATION_RADIUS_METERS}
              pathOptions={{ color: DESTINATION_COLOR, opacity: 0.7 }}
            />
          </>
        ) : null}
        {dronePosition !== null ? (
          <Marker position={dronePosition} icon={droneIcon} />
        ) : null}
      </MapContainer>
      <div className={MAP_LABEL_CLASS_NAME}>{mapLabel}</div>
    </div>
  );
}
