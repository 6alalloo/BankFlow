import express from "express";
import cors from "cors";
import routes from "./routes";
import { requestIdMiddleware } from "./middleware/requestIdMiddleware";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

const app = express();

// Middleware configuration applied before route handlers
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);

// Simple health check route
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "BankFlow backend" });
});

// Mount all API routes under /api
app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
