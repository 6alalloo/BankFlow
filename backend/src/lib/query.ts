import { Request } from "express";

export type PageQuery = {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
};

export const parsePageQuery = (req: Request): PageQuery => {
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const requestedPageSize = Number.parseInt(String(req.query.pageSize ?? req.query.limit ?? "25"), 10) || 25;
  const pageSize = Math.min(100, Math.max(1, requestedPageSize));

  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
    page,
    pageSize,
  };
};

export const parseNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
};

export const parseDate = (value: unknown): Date | undefined => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const parseBoolean = (value: unknown): boolean | undefined => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
};

export const pageMeta = (pageQuery: PageQuery, total: number) => ({
  page: pageQuery.page,
  pageSize: pageQuery.pageSize,
  total,
  totalPages: Math.ceil(total / pageQuery.pageSize),
});
