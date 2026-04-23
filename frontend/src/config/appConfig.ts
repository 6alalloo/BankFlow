/**
 * Frontend Application Configuration
 *
 * This module validates and exports all frontend configuration.
 * Configuration is loaded from Vite environment variables (import.meta.env).
 */

interface FrontendConfig {
  apiBaseUrl: string;
  environment: string;
}

function validateConfig(): FrontendConfig {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

  // In production, VITE_API_BASE_URL is required
  if (!apiBaseUrl && import.meta.env.MODE === 'production') {
    throw new Error(
      'VITE_API_BASE_URL is required in production mode.\n' +
      'Please set this environment variable during the build process.'
    );
  }

  return {
    apiBaseUrl: apiBaseUrl || 'http://localhost:4000/api',
    environment: import.meta.env.MODE || 'development'
  };
}

// Validate and export configuration
export const config = validateConfig();
