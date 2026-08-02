"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

interface DurationSliderProps {
  min?: number;
  max?: number;
  nativeOptions: number[];
  extendedOptions?: number[];
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
  nativeLabel?: string;
  extendedLabel?: string;
  unavailableLabel?: string;
  secondsLabel?: string;
  ariaLabel?: string;
}

interface Segment {
  start: number;
  end: number;
}

function normalizeOptions(options: number[], min: number, max: number) {
  return [...new Set(options)]
    .filter((option) => Number.isInteger(option) && option >= min && option <= max)
    .sort((left, right) => left - right);
}

function buildSegments(options: number[]): Segment[] {
  if (options.length === 0) return [];

  const segments: Segment[] = [];
  let start = options[0]!;
  let previous = start;

  for (const option of options.slice(1)) {
    if (option === previous + 1) {
      previous = option;
      continue;
    }
    segments.push({ start, end: previous });
    start = option;
    previous = option;
  }
  segments.push({ start, end: previous });
  return segments;
}

function nearestOption(value: number, options: number[]) {
  return options.reduce((nearest, option) =>
    Math.abs(option - value) < Math.abs(nearest - value) ? option : nearest
  );
}

export function DurationSlider({
  min = 5,
  max = 30,
  nativeOptions,
  extendedOptions = [],
  value,
  onChange,
  disabled = false,
  className,
  nativeLabel = "Native",
  extendedLabel = "Official extension",
  unavailableLabel = "Unavailable",
  secondsLabel = "seconds",
  ariaLabel = "Video duration",
}: DurationSliderProps) {
  const native = useMemo(
    () => normalizeOptions(nativeOptions, min, max),
    [max, min, nativeOptions]
  );
  const extended = useMemo(
    () => normalizeOptions(extendedOptions, min, max),
    [extendedOptions, max, min]
  );
  const selectable = useMemo(
    () => normalizeOptions([...native, ...extended], min, max),
    [extended, max, min, native]
  );
  const nativeSegments = useMemo(() => buildSegments(native), [native]);
  const extendedSegments = useMemo(() => buildSegments(extended), [extended]);

  if (selectable.length === 0) {
    return (
      <div className={cn("rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-400", className)}>
        {unavailableLabel}
      </div>
    );
  }

  const currentValue = selectable.includes(value)
    ? value
    : nearestOption(value, selectable);
  const percent = (duration: number) =>
    ((duration - min) / Math.max(1, max - min)) * 100;

  const renderSegment = (segment: Segment, tone: "native" | "extended") => {
    const isPoint = segment.start === segment.end;
    return (
      <span
        key={`${tone}-${segment.start}-${segment.end}`}
        aria-hidden="true"
        className={cn(
          "absolute top-0 h-full rounded-full",
          tone === "native" ? "bg-blue-500" : "bg-violet-400/75"
        )}
        style={{
          left: `${percent(segment.start)}%`,
          width: isPoint
            ? "4px"
            : `${Math.max(0, percent(segment.end) - percent(segment.start))}%`,
          transform: isPoint ? "translateX(-2px)" : undefined,
        }}
      />
    );
  };

  return (
    <div className={cn("space-y-3", className)}>
      <SliderPrimitive.Root
        value={[currentValue]}
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        onValueChange={(values) => {
          const requested = values[0] ?? currentValue;
          onChange(nearestOption(requested, selectable));
        }}
        className="relative flex h-6 w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-visible rounded-full bg-slate-700">
          {nativeSegments.map((segment) => renderSegment(segment, "native"))}
          {extendedSegments.map((segment) => renderSegment(segment, "extended"))}
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={ariaLabel}
          aria-valuetext={`${currentValue} ${secondsLabel}`}
          className="block h-5 w-5 rounded-full border-2 border-blue-400 bg-slate-950 shadow-md shadow-black/40 ring-offset-slate-950 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:opacity-50"
        />
      </SliderPrimitive.Root>

      <div className="relative h-6 text-xs text-slate-400">
        <span className="absolute left-0">{min}s</span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-md bg-blue-500/15 px-2 py-0.5 font-semibold text-blue-200">
          {currentValue}s
        </span>
        <span className="absolute right-0">{max}s</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-blue-500" />{nativeLabel}</span>
        {extended.length > 0 ? (
          <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-violet-400/75" />{extendedLabel}</span>
        ) : null}
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-slate-700" />{unavailableLabel}</span>
      </div>
    </div>
  );
}

export default DurationSlider;
