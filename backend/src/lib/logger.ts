/**
 * Centralized Logging Module using Winston
 *
 * Provides structured logging with:
 * - Log levels: error, warn, info, debug
 * - JSON format for production (easy parsing)
 * - Colorized, readable format for development
 * - Automatic timestamp and service metadata
 */

import winston from 'winston';
import { config } from '../config/appConfig';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const logger = winston.createLogger({
  level: config.server.nodeEnv === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'hrflow-backend' },
  transports: [
    new winston.transports.Console({
      format: config.server.nodeEnv === 'production'
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length > 0 && meta.service !== 'hrflow-backend'
                ? `\n${JSON.stringify(meta, null, 2)}`
                : '';
              return `${timestamp} [${level}]: ${message}${metaStr}`;
            })
          )
    })
  ]
});

export default logger;
