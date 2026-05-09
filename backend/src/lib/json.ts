import { Prisma } from "@prisma/client";

export const toInputJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
