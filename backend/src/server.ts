import path from "path";
import dotenv from "dotenv";

// Load .env from project root (two directories up from dist/)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { config } from "./config/appConfig";
import logger from "./lib/logger";
import app from "./app";

app.listen(config.server.port, () => {
  logger.info('HRFlow backend started', {
    port: config.server.port,
    environment: config.server.nodeEnv,
    nodeVersion: process.version
  });
});
