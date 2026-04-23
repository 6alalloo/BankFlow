// backend/src/services/allowListService.ts
// Full implementation using allowed_domains table

import prisma from "../lib/prisma";

export interface DomainValidationResult {
  allowed: boolean;
  reason?: string;
  matchedRule?: string;
}

export interface AllowedDomain {
  id: number;
  domain: string;
  created_by: number | null;
  created_at: Date;
  user?: {
    id: number;
    email: string;
  } | null;
}

/**
 * Check if a URL is allowed based on the allowlist
 * If no domains are configured, defaults to ALLOW ALL (open mode)
 * If domains are configured, only those domains are allowed
 */
export async function isUrlAllowed(url: string): Promise<DomainValidationResult> {
  try {
    // Parse URL to validate format
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Get all allowed domains
    const allowedDomains = await prisma.allowed_domains.findMany();

    // If no domains configured, allow everything (open mode)
    if (allowedDomains.length === 0) {
      return {
        allowed: true,
        reason: "Open mode - no allowlist configured",
        matchedRule: hostname,
      };
    }

    // Check if hostname matches any allowed domain
    const match = allowedDomains.find((d) => {
      const allowedDomain = d.domain.toLowerCase();
      // Exact match or subdomain match
      return hostname === allowedDomain || hostname.endsWith("." + allowedDomain);
    });

    if (match) {
      return {
        allowed: true,
        reason: "Domain is in allowlist",
        matchedRule: match.domain,
      };
    }

    return {
      allowed: false,
      reason: `Domain "${hostname}" is not in the allow-list`,
    };
  } catch (error) {
    // Invalid URL
    return {
      allowed: false,
      reason: `Invalid URL format: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Add a domain to the allowlist
 */
export async function addDomainToAllowList(
  domain: string,
  createdByUserId?: number
): Promise<AllowedDomain> {
  const normalizedDomain = domain.toLowerCase().trim();

  const created = await prisma.allowed_domains.create({
    data: {
      domain: normalizedDomain,
      created_by: createdByUserId || null,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  return created;
}

/**
 * Remove a domain from the allowlist by ID
 */
export async function removeDomainFromAllowList(domainId: number): Promise<boolean> {
  try {
    await prisma.allowed_domains.delete({
      where: { id: domainId },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all domains in the allowlist
 */
export async function getAllowList(): Promise<AllowedDomain[]> {
  const domains = await prisma.allowed_domains.findMany({
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
    orderBy: { created_at: "desc" },
  });

  return domains;
}

/**
 * Check if a domain already exists in the allowlist
 */
export async function domainExists(domain: string): Promise<boolean> {
  const normalizedDomain = domain.toLowerCase().trim();
  const existing = await prisma.allowed_domains.findUnique({
    where: { domain: normalizedDomain },
  });
  return existing !== null;
}

/**
 * Validate multiple URLs at once
 */
export async function validateUrls(urls: string[]): Promise<Map<string, DomainValidationResult>> {
  const results = new Map<string, DomainValidationResult>();

  for (const url of urls) {
    const result = await isUrlAllowed(url);
    results.set(url, result);
  }

  return results;
}

/**
 * Extract all URLs from workflow configuration
 */
export function extractUrlsFromWorkflow(nodes: { kind: string; config?: Record<string, unknown> }[]): string[] {
  const urls: string[] = [];

  for (const node of nodes) {
    const config = node.config || {};

    // HTTP node URLs
    if (node.kind === "http" && typeof config.url === "string") {
      urls.push(config.url);
    }

    // CV parse node URLs
    if (node.kind === "cv_parse" && config.inputType === "url" && typeof config.cvUrl === "string") {
      urls.push(config.cvUrl);
    }

    // Check for URLs in any string config values
    for (const value of Object.values(config)) {
      if (typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://"))) {
        urls.push(value);
      }
    }
  }

  return [...new Set(urls)]; // Remove duplicates
}
