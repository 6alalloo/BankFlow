/**
 * Centralized Application Configuration
 *
 * This module validates and exports all application configuration.
 * The app will fail to start with clear error messages if required
 * environment variables are missing.
 */

interface AppConfig {
  server: {
    port: number;
    nodeEnv: string;
  };
  database: {
    url: string;
  };
  jwt: {
    secret: string;
    expiresIn: string | number;
  };
  email: {
    defaultSender: string;
  defaultRecipient: string;   // For demo/test case flows
  };
}

function validateConfig(): AppConfig {
  // Check required environment variables
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Check the .env file and ensure all required variables are set.\n` +
      `See .env.example for reference.`
    );
  }

  // Validate and return configuration
  return {
    server: {
      port: parseInt(process.env.PORT || '4000', 10),
      nodeEnv: process.env.NODE_ENV || 'development'
    },
    database: {
      url: process.env.DATABASE_URL!
    },
    jwt: {
      secret: process.env.JWT_SECRET!,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    },
    email: {
      defaultSender: process.env.DEFAULT_EMAIL_SENDER || 'noreply@bankflow.local',
      defaultRecipient: process.env.DEFAULT_EMAIL_RECIPIENT || 'demo@example.com'
    }
  };
}

// Validate and export configuration
// This will throw on startup if required env vars are missing
export const config = validateConfig();
