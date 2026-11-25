import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { config } from "./config";
import { errorHandler, notFound } from "./errors";
import { fail } from "./http";
import { openapi } from "./openapi";
import { apiRouter } from "./routes";

export const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi));

app.use("/api", apiRouter);

app.use(notFound);

// Malformed JSON bodies are the client's fault: 400, not 500.
const badJson: ErrorRequestHandler = (err, _req, res, next) =>
  err?.type === "entity.parse.failed" ? void fail(res, 400, "INVALID_JSON", "Request body is not valid JSON") : next(err);
app.use(badJson);

app.use(errorHandler);