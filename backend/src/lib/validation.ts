import { Request } from "express";
import { createValidationError } from "../types/errors";

type BodyObject = Record<string, unknown>;

export const asBodyObject = (req: Request): BodyObject => {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    return req.body as BodyObject;
  }

  throw createValidationError("Request body must be a JSON object", "body");
};

export const optionalBodyObject = (req: Request): BodyObject => {
  if (req.body === undefined) return {};
  return asBodyObject(req);
};

export const readIntegerParam = (req: Request, key: string, label = key): number => {
  const parsed = Number(req.params[key]);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw createValidationError(`Invalid ${label}`, key);
  }

  return parsed;
};

export const readRequiredString = (body: BodyObject, key: string, label = key): string => {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw createValidationError(`${label} is required`, key);
  }

  return value.trim();
};

export const readOptionalString = (body: BodyObject, key: string): string | undefined => {
  const value = body[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw createValidationError(`${key} must be a string`, key);
  }

  return value.trim();
};

export const readOptionalNullableString = (body: BodyObject, key: string): string | null | undefined => {
  const value = body[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw createValidationError(`${key} must be a string or null`, key);
  }

  return value.trim();
};

export const readOptionalInteger = (value: unknown, label: string): number | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw createValidationError(`${label} must be a positive integer or null`, label);
  }

  return parsed;
};

export const readRequiredInteger = (body: BodyObject, key: string, label = key): number => {
  const parsed = readOptionalInteger(body[key], label);
  if (parsed === undefined || parsed === null) {
    throw createValidationError(`${label} is required`, key);
  }

  return parsed;
};

export const readOptionalNumber = (body: BodyObject, key: string): number | undefined => {
  const value = body[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw createValidationError(`${key} must be a finite number`, key);
  }

  return value;
};

export const readOptionalObject = (body: BodyObject, key: string): Record<string, unknown> | undefined => {
  const value = body[key];
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createValidationError(`${key} must be an object`, key);
  }

  return value as Record<string, unknown>;
};

export const readOptionalEnum = <T extends string>(
  body: BodyObject,
  key: string,
  allowedValues: ReadonlySet<T>,
  message = `${key} must be one of: ${Array.from(allowedValues).join(", ")}`
): T | undefined => {
  const value = body[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !allowedValues.has(value as T)) {
    throw createValidationError(message, key);
  }

  return value as T;
};
