import { useEffect, useRef, useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { lerp } from "@/lib/utils";
import type { TelemetriaResponse } from "@/types/api";

import { useTelemetryStore } from "../store/useTelemetryStore";

const DEFAULT_SPEED = 1;
const SPEED_OPTIONS = [0.5, 1, 2, 4] as const;
const REPLAY_LABEL = "Modo Replay";
const EMPTY_LABEL = "--";
const TIMELINE_CLASS_NAME =
  "flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-4";
const SPEED_BUTTON_GROUP_CLASS_NAME = "flex flex-wrap gap-2";
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "medium",
});

type ReplaySpeed = (typeof SPEED_OPTIONS)[number];

function getSliderMax(history: TelemetriaResponse[]): number {
  return Math.max(history.length - 1, 0);
}

function getFrameTimestamp(frame: TelemetriaResponse): number {
  return Date.parse(frame.criado_em);
}

function clampIndex(index: number, history: TelemetriaResponse[]): number {
  return Math.min(Math.max(index, 0), getSliderMax(history));
}

function clampProgress(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function getFrameByIndex(
  history: TelemetriaResponse[],
  index: number,
): TelemetriaResponse | null {
  if (history.length === 0) {
    return null;
  }

  return history[clampIndex(index, history)];
}

function formatFrameTimestamp(frame: TelemetriaResponse | null): string {
  if (frame === null) {
    return EMPTY_LABEL;
  }

  const timestamp = getFrameTimestamp(frame);

  if (Number.isNaN(timestamp)) {
    return EMPTY_LABEL;
  }

  return DATE_TIME_FORMATTER.format(timestamp);
}

function buildInterpolatedFrame(
  currentFrame: TelemetriaResponse,
  nextFrame: TelemetriaResponse,
  replayTimestamp: number,
): TelemetriaResponse {
  const currentTimestamp = getFrameTimestamp(currentFrame);
  const nextTimestamp = getFrameTimestamp(nextFrame);
  const duration = nextTimestamp - currentTimestamp;
  const safeDuration = duration <= 0 ? 1 : duration;
  const progress = clampProgress((replayTimestamp - currentTimestamp) / safeDuration);

  return {
    ...currentFrame,
    latitude: lerp(currentFrame.latitude, nextFrame.latitude, progress),
    longitude: lerp(currentFrame.longitude, nextFrame.longitude, progress),
    altitude_m: lerp(currentFrame.altitude_m, nextFrame.altitude_m, progress),
    velocidade_ms: lerp(
      currentFrame.velocidade_ms,
      nextFrame.velocidade_ms,
      progress,
    ),
    criado_em: new Date(replayTimestamp).toISOString(),
  };
}

function getSegmentIndex(
  history: TelemetriaResponse[],
  replayTimestamp: number,
  currentIndex: number,
): number {
  const lastIndex = getSliderMax(history);
  let segmentIndex = clampIndex(currentIndex, history);

  while (
    segmentIndex < lastIndex - 1 &&
    replayTimestamp >= getFrameTimestamp(history[segmentIndex + 1])
  ) {
    segmentIndex += 1;
  }

  while (
    segmentIndex > 0 &&
    replayTimestamp < getFrameTimestamp(history[segmentIndex])
  ) {
    segmentIndex -= 1;
  }

  return segmentIndex;
}

export function ReplayTimeline(): ReactElement {
  const history = useTelemetryStore((state) => state.history);
  const isReplaying = useTelemetryStore((state) => state.isReplaying);
  const setReplaying = useTelemetryStore((state) => state.setReplaying);
  const setFrame = useTelemetryStore((state) => state.setFrame);
  const intervalIdRef = useRef<number | null>(null);
  const currentIndexRef = useRef(0);
  const replayOffsetRef = useRef<number | null>(null);
  const [sliderValue, setSliderValue] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<ReplaySpeed>(DEFAULT_SPEED);

  function clearReplayInterval(): void {
    if (intervalIdRef.current === null) {
      return;
    }

    window.clearInterval(intervalIdRef.current);
    intervalIdRef.current = null;
  }

  function stopReplay(): void {
    clearReplayInterval();
    setReplaying(false);
  }

  function syncFrameAtIndex(index: number): void {
    const frame = getFrameByIndex(history, index);

    if (frame === null) {
      return;
    }

    currentIndexRef.current = clampIndex(index, history);
    setSliderValue(currentIndexRef.current);
    setFrame(frame);
  }

  function tickReplay(): void {
    if (history.length < 2 || replayOffsetRef.current === null) {
      stopReplay();
      return;
    }

    const replayTimestamp = Date.now() - replayOffsetRef.current;
    const lastIndex = getSliderMax(history);
    const lastFrame = history[lastIndex];
    const lastTimestamp = getFrameTimestamp(lastFrame);

    if (replayTimestamp >= lastTimestamp) {
      currentIndexRef.current = lastIndex;
      setSliderValue(lastIndex);
      setFrame(lastFrame);
      stopReplay();
      return;
    }

    const segmentIndex = getSegmentIndex(
      history,
      replayTimestamp,
      currentIndexRef.current,
    );
    const currentFrame = history[segmentIndex];
    const nextFrame = history[segmentIndex + 1];
    const interpolatedFrame = buildInterpolatedFrame(
      currentFrame,
      nextFrame,
      replayTimestamp,
    );

    currentIndexRef.current = segmentIndex;
    setSliderValue(segmentIndex);
    setFrame(interpolatedFrame);
  }

  function startReplayInterval(): void {
    clearReplayInterval();
    intervalIdRef.current = window.setInterval(
      tickReplay,
      1000 / playbackSpeed,
    );
  }

  function handleReplayToggle(checked: boolean): void {
    if (!checked) {
      clearReplayInterval();
      setReplaying(false);
      return;
    }

    if (history.length < 2) {
      setReplaying(false);
      syncFrameAtIndex(currentIndexRef.current);
      return;
    }

    const startFrame = getFrameByIndex(history, currentIndexRef.current);

    if (startFrame === null) {
      setReplaying(false);
      return;
    }

    replayOffsetRef.current = Date.now() - getFrameTimestamp(startFrame);
    setReplaying(true);
    startReplayInterval();
  }

  function handleSliderChange(values: number[]): void {
    const nextValue = values[0] ?? 0;

    clearReplayInterval();
    setReplaying(false);
    syncFrameAtIndex(nextValue);
  }

  function handleSpeedChange(speed: ReplaySpeed): void {
    setPlaybackSpeed(speed);

    if (!isReplaying) {
      return;
    }

    startReplayInterval();
  }

  useEffect(() => {
    const nextMaxIndex = getSliderMax(history);
    const nextIndex = Math.min(currentIndexRef.current, nextMaxIndex);

    clearReplayInterval();
    setReplaying(false);
    currentIndexRef.current = nextIndex;
    setSliderValue(nextIndex);

    return () => {
      clearReplayInterval();
    };
  }, [history]);

  const currentTimelineFrame = getFrameByIndex(history, sliderValue);
  const sliderMax = getSliderMax(history);

  return (
    <div className={TIMELINE_CLASS_NAME}>
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-muted-foreground">
          {REPLAY_LABEL}
        </label>
        <Switch checked={isReplaying} onCheckedChange={handleReplayToggle} />
      </div>

      <Slider
        value={[sliderValue]}
        min={0}
        max={sliderMax}
        step={1}
        disabled={history.length === 0}
        onValueChange={handleSliderChange}
      />

      <div className={SPEED_BUTTON_GROUP_CLASS_NAME}>
        {SPEED_OPTIONS.map((speed) => (
          <Button
            key={speed}
            type="button"
            size="sm"
            variant={playbackSpeed === speed ? "default" : "outline"}
            onClick={() => handleSpeedChange(speed)}
          >
            {speed}x
          </Button>
        ))}
      </div>

      <p className="font-mono text-xs tabular-nums text-muted-foreground">
        {formatFrameTimestamp(currentTimelineFrame)}
      </p>
    </div>
  );
}
