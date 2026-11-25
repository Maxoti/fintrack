import { Router } from "express";
import { requireAuth } from "./auth";
import { authRouter } from "./auth";
import { instrumentsRouter } from "./instruments";
import { portfoliosRouter } from "./portfolios";
import { transactionsRouter } from "./transactions";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/instruments", requireAuth, instrumentsRouter);
apiRouter.use("/portfolios", requireAuth, portfoliosRouter);
apiRouter.use(transactionsRouter); // per-route auth inside (paths: /portfolios/:id/transactions, /transactions/:id)