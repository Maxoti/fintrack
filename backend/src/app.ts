import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { config } from "./config";
import { errorHandler, notFound } from "./errors";
import { openapi } from "./openapi";

export const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi));

// Routers are mounted here as they are built:
// app.use("/api/auth", authRouter);
// app.use("/api/portfolios", portfoliosRouter);

app.use(notFound);
app.use(errorHandler);