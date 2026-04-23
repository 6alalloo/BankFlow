// backend/src/middleware/rateLimiter.ts
// Simple in-memory rate limiter for login attempts

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
}

// In-memory store for rate limiting
// In production, use Redis for distributed systems
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const LOGIN_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5; // Max 5 attempts per minute

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.firstAttempt > LOGIN_RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Get a unique key for rate limiting based on IP and email
 */
function getRateLimitKey(ip: string, email?: string): string {
  // Use both IP and email if available for more granular limiting
  if (email) {
    return `${ip}:${email.toLowerCase()}`;
  }
  return ip;
}

/**
 * Check if a request should be rate limited
 * @returns true if request should be blocked, false if allowed
 */
export function isRateLimited(ip: string, email?: string): boolean {
  const key = getRateLimitKey(ip, email);
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry) {
    // First attempt
    rateLimitStore.set(key, { count: 1, firstAttempt: now });
    return false;
  }

  // Check if window has expired
  if (now - entry.firstAttempt > LOGIN_RATE_LIMIT_WINDOW_MS) {
    // Reset window
    rateLimitStore.set(key, { count: 1, firstAttempt: now });
    return false;
  }

  // Within window - check count
  if (entry.count >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
    return true; // Rate limited
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);
  return false;
}

/**
 * Get remaining attempts for a given IP/email combo
 */
export function getRemainingAttempts(ip: string, email?: string): number {
  const key = getRateLimitKey(ip, email);
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry) {
    return LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
  }

  // Check if window has expired
  if (now - entry.firstAttempt > LOGIN_RATE_LIMIT_WINDOW_MS) {
    return LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
  }

  return Math.max(0, LOGIN_RATE_LIMIT_MAX_ATTEMPTS - entry.count);
}

/**
 * Reset rate limit for a given IP/email (e.g., after successful login)
 */
export function resetRateLimit(ip: string, email?: string): void {
  const key = getRateLimitKey(ip, email);
  rateLimitStore.delete(key);
}

/**
 * Get time remaining until rate limit resets (in seconds)
 */
export function getTimeUntilReset(ip: string, email?: string): number {
  const key = getRateLimitKey(ip, email);
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry) {
    return 0;
  }

  const elapsed = now - entry.firstAttempt;
  const remaining = LOGIN_RATE_LIMIT_WINDOW_MS - elapsed;

  return Math.max(0, Math.ceil(remaining / 1000));
}
