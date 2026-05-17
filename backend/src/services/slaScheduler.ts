import prisma from "../lib/prisma";
import logger from "../lib/logger";
import { processOverdueWork } from "./slaService";

let timer: NodeJS.Timeout | null = null;

export function startSlaScheduler() {
  if (timer) return timer;

  const intervalMs = Number(process.env.SLA_SWEEP_INTERVAL_MS || 60_000);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    logger.warn("SLA scheduler disabled because SLA_SWEEP_INTERVAL_MS is invalid", {
      service: "slaScheduler",
      intervalMs: process.env.SLA_SWEEP_INTERVAL_MS,
    });
    return null;
  }

  const runSweep = async () => {
    try {
      const result = await processOverdueWork();
      await prisma.audit_logs.create({
        data: {
          actor_user_id: null,
          action: "sla_scheduler_sweep",
          entity_type: "sla",
          data_json: JSON.stringify({ details: result }),
        },
      });
      logger.info("SLA scheduler sweep completed", {
        service: "slaScheduler",
        ...result,
      });
    } catch (error) {
      logger.error("SLA scheduler sweep failed", {
        service: "slaScheduler",
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  };

  timer = setInterval(runSweep, intervalMs);
  timer.unref();
  void runSweep();

  logger.info("SLA scheduler started", {
    service: "slaScheduler",
    intervalMs,
  });

  return timer;
}

export function stopSlaScheduler() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
