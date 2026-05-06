import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";

import L, { type DivIcon, type LatLngExpression } from "leaflet";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";

import { lerp } from "@/lib/utils";
import type { PosicaoAtualResponse, WSTelemetriaPayload } from "@/types/api";

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
const DRONE_OPACITY_LOST = 0.5;
const DRONE_OPACITY_DEFAULT = 1;
const DRONE_ANIMATION_DURATION_MS = 220;
const MAP_WRAPPER_CLASS_NAME =
  "relative h-full min-h-[420px] w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[#080c11]";
const MAP_CLASS_NAME = "h-full w-full";
const MAP_LABEL_CLASS_NAME =
  "pointer-events-none absolute bottom-5 left-5 z-[500] rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-card)] px-3 py-1 font-mono text-[11px] text-[var(--text-muted)]";

interface MapCanvasProps {
  routePoints: [number, number][];
  destination: [number, number] | null;
  currentFrame: WSTelemetriaPayload | null;
  positionSnapshot: PosicaoAtualResponse | null;
  droneDirection: number | null;
  signalLost: boolean;
}

interface FitBoundsControllerProps {
  points: [number, number][];
}

interface StaticRouteLayerProps {
  routePoints: [number, number][];
  destination: [number, number] | null;
}

interface DroneMarkerLayerProps {
  dronePosition: [number, number] | null;
  droneDirection: number | null;
  signalLost: boolean;
}

function createDroneIconHtml(direction: number, signalLost: boolean): string {
  const fillColor = signalLost ? "#94a3b8" : ROUTE_COLOR;
  const opacity = signalLost ? DRONE_OPACITY_LOST : DRONE_OPACITY_DEFAULT;
  const filter = signalLost ? "grayscale(1)" : "none";

  return `
    <div style="width:24px;height:24px;transform:rotate(${direction}deg);transform-origin:center center;display:flex;align-items:center;justify-content:center;opacity:${opacity};filter:${filter};">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M12 2L21 22L12 17L3 22L12 2Z" fill="${fillColor}" />
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

function createDroneIcon(direction: number, signalLost: boolean): DivIcon {
  return L.divIcon({
    className: "",
    html: createDroneIconHtml(direction, signalLost),
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
  currentFrame: WSTelemetriaPayload | null,
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
  currentFrame: WSTelemetriaPayload | null,
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

  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)} - alt ${altitudeLabel}m`;
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

const StaticRouteLayer = memo(function StaticRouteLayer({
  routePoints,
  destination,
}: StaticRouteLayerProps): ReactElement {
  return (
    <>
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
    </>
  );
});

const DroneMarkerLayer = memo(function DroneMarkerLayer({
  dronePosition,
  droneDirection,
  signalLost,
}: DroneMarkerLayerProps): ReactElement | null {
  const animationFrameRef = useRef<number | null>(null);
  const [animatedPosition, setAnimatedPosition] = useState<[number, number] | null>(
    dronePosition,
  );
  const droneIcon = useMemo(
    () => createDroneIcon(droneDirection ?? 0, signalLost),
    [droneDirection, signalLost],
  );

  useEffect(() => {
    if (dronePosition === null) {
      setAnimatedPosition(null);
      return;
    }

    const startPosition = animatedPosition ?? dronePosition;
    const [startLat, startLng] = startPosition;
    const [targetLat, targetLng] = dronePosition;
    const startedAt = window.performance.now();

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }

    const animate = (timestamp: number): void => {
      const elapsed = timestamp - startedAt;
      const progress = Math.min(elapsed / DRONE_ANIMATION_DURATION_MS, 1);

      setAnimatedPosition([
        lerp(startLat, targetLat, progress),
        lerp(startLng, targetLng, progress),
      ]);

      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animatedPosition, dronePosition]);

  if (animatedPosition === null) {
    return null;
  }

  return <Marker position={animatedPosition} icon={droneIcon} />;
});

export function MapCanvas({
  routePoints,
  destination,
  currentFrame,
  positionSnapshot,
  droneDirection,
  signalLost,
}: MapCanvasProps): ReactElement {
  const dronePosition = getDronePosition(currentFrame, positionSnapshot);
  const mapCenter = getMapCenter(routePoints, destination, dronePosition);
  const overlayPoints = useMemo(() => {
    const points = [...routePoints];

    if (destination !== null) {
      points.push(destination);
    }

    return points;
  }, [destination, routePoints]);
  const mapLabel = getMapLabel(currentFrame, positionSnapshot);

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
        <StaticRouteLayer routePoints={routePoints} destination={destination} />
        <DroneMarkerLayer
          dronePosition={dronePosition}
          droneDirection={droneDirection}
          signalLost={signalLost}
        />
      </MapContainer>
      <div className={MAP_LABEL_CLASS_NAME}>{mapLabel}</div>
    </div>
  );
}
