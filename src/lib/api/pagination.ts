import { ApiError } from "./error";

interface IntegerParamOptions {
  name: string;
  defaultValue: number;
  min: number;
  max: number;
}

export function parseBoundedInteger(
  raw: string | null,
  options: IntegerParamOptions
) {
  if (raw === null) return options.defaultValue;
  if (!/^\d+$/.test(raw)) {
    throw new ApiError(`${options.name} must be an integer`, 400);
  }
  const value = Number(raw);
  if (
    !Number.isSafeInteger(value) ||
    value < options.min ||
    value > options.max
  ) {
    throw new ApiError(
      `${options.name} must be between ${options.min} and ${options.max}`,
      400
    );
  }
  return value;
}

export function parsePageLimit(raw: string | null, defaultValue = 20) {
  return parseBoundedInteger(raw, {
    name: "limit",
    defaultValue,
    min: 1,
    max: 100,
  });
}

export function parsePageOffset(raw: string | null) {
  return parseBoundedInteger(raw, {
    name: "offset",
    defaultValue: 0,
    min: 0,
    max: 10_000,
  });
}

export function parsePositiveCursor(raw: string | null) {
  if (raw === null) return undefined;
  return parseBoundedInteger(raw, {
    name: "cursor",
    defaultValue: 1,
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
  });
}
