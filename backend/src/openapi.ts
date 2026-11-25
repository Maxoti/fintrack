// OpenAPI 3 spec served at /api/docs (Swagger UI).
const ref = (n: string) => ({ $ref: `#/components/schemas/${n}` });
const json = (schema: object) => ({ "application/json": { schema } });
const errorResponse = (description: string) => ({ description, content: json(ref("Error")) });
const idParam = { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } };
const secured = [{ bearerAuth: [] }];
const common = {
  401: errorResponse("Missing, invalid or expired token"),
};

export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "FinTrack API",
    version: "1.0.0",
    description:
      "Portfolio & transactions tracker by Finnet Technologies. Log in via POST /api/auth/login, then click Authorize and paste the token. " +
      "All errors use one shape: { error: { code, message, details? } }.",
  },
  servers: [{ url: "/" }],
  tags: [{ name: "Auth" }, { name: "Portfolios" }, { name: "Transactions" }, { name: "Reference" }, { name: "System" }],
  paths: {
    "/api/health": {
      get: { tags: ["System"], summary: "Liveness check", responses: { 200: { description: "OK", content: json({ type: "object", properties: { status: { type: "string", example: "ok" } } }) } } },
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"], summary: "Register an analyst",
        requestBody: { required: true, content: json(ref("RegisterInput")) },
        responses: { 201: { description: "Created", content: json({ type: "object", properties: { user: ref("User") } }) }, 409: errorResponse("Email already registered"), 422: errorResponse("Validation error") },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"], summary: "Log in and receive a JWT",
        requestBody: { required: true, content: json(ref("LoginInput")) },
        responses: { 200: { description: "OK", content: json({ type: "object", properties: { token: { type: "string" }, user: ref("User") } }) }, 401: errorResponse("Invalid email or password"), 422: errorResponse("Validation error") },
      },
    },
    "/api/instruments": {
      get: { tags: ["Reference"], summary: "List tradable instruments with latest price", security: secured, responses: { 200: { description: "OK", content: json({ type: "object", properties: { instruments: { type: "array", items: ref("Instrument") } } }) }, ...common } },
    },
    "/api/portfolios": {
      get: { tags: ["Portfolios"], summary: "List the analyst's portfolios", security: secured, responses: { 200: { description: "OK", content: json({ type: "object", properties: { portfolios: { type: "array", items: ref("Portfolio") } } }) }, ...common } },
      post: {
        tags: ["Portfolios"], summary: "Create a portfolio", security: secured,
        requestBody: { required: true, content: json(ref("PortfolioInput")) },
        responses: { 201: { description: "Created", content: json({ type: "object", properties: { portfolio: ref("Portfolio") } }) }, 409: errorResponse("Duplicate portfolio name"), 422: errorResponse("Validation error"), ...common },
      },
    },
    "/api/portfolios/{id}": {
      get: { tags: ["Portfolios"], summary: "Get a portfolio", security: secured, parameters: [idParam], responses: { 200: { description: "OK", content: json({ type: "object", properties: { portfolio: ref("Portfolio") } }) }, 404: errorResponse("Portfolio not found"), ...common } },
      put: {
        tags: ["Portfolios"], summary: "Update a portfolio", security: secured, parameters: [idParam],
        description: "Base currency cannot be changed once the portfolio has transactions.",
        requestBody: { required: true, content: json(ref("PortfolioInput")) },
        responses: { 200: { description: "OK", content: json({ type: "object", properties: { portfolio: ref("Portfolio") } }) }, 404: errorResponse("Portfolio not found"), 409: errorResponse("Conflict"), 422: errorResponse("Validation error"), ...common },
      },
      delete: { tags: ["Portfolios"], summary: "Delete a portfolio and its transactions", security: secured, parameters: [idParam], responses: { 204: { description: "Deleted" }, 404: errorResponse("Portfolio not found"), ...common } },
    },
    "/api/portfolios/{id}/summary": {
      get: { tags: ["Portfolios"], summary: "Holdings summary", description: "Per-instrument net quantity, average cost (weighted average buy price), total invested (net qty x average cost) and total value (net qty x latest price).", security: secured, parameters: [idParam], responses: { 200: { description: "OK", content: json(ref("Summary")) }, 404: errorResponse("Portfolio not found"), ...common } },
    },
    "/api/portfolios/{id}/transactions": {
      get: {
        tags: ["Transactions"], summary: "List transactions (filter and sort)", security: secured,
        parameters: [
          idParam,
          { name: "instrument", in: "query", schema: { type: "string", example: "SCOM" } },
          { name: "type", in: "query", schema: { type: "string", enum: ["BUY", "SELL"] } },
          { name: "sort", in: "query", schema: { type: "string", enum: ["tradeDate", "instrument", "type", "quantity", "unitPrice", "amount"], default: "tradeDate" } },
          { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"], default: "desc" } },
        ],
        responses: { 200: { description: "OK", content: json({ type: "object", properties: { transactions: { type: "array", items: ref("Transaction") } } }) }, 404: errorResponse("Portfolio not found"), 422: errorResponse("Invalid query"), ...common },
      },
      post: {
        tags: ["Transactions"], summary: "Record a BUY or SELL", security: secured, parameters: [idParam],
        description: "Rejected with 422 for invalid input, an unknown instrument, an instrument whose currency differs from the portfolio's, or a SELL larger than the current holding.",
        requestBody: { required: true, content: json(ref("TransactionInput")) },
        responses: { 201: { description: "Created", content: json({ type: "object", properties: { transaction: ref("Transaction") } }) }, 404: errorResponse("Portfolio not found"), 422: errorResponse("Validation or business-rule error"), ...common },
      },
    },
    "/api/transactions/{id}": {
      delete: {
        tags: ["Transactions"], summary: "Delete a transaction", security: secured, parameters: [idParam],
        description: "Returns 409 if removing a BUY would leave a later SELL uncovered.",
        responses: { 204: { description: "Deleted" }, 404: errorResponse("Transaction not found"), 409: errorResponse("Would make holdings negative"), ...common },
      },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      Error: { type: "object", required: ["error"], properties: { error: { type: "object", required: ["code", "message"], properties: { code: { type: "string", example: "VALIDATION_ERROR" }, message: { type: "string" }, details: { type: "object", additionalProperties: { type: "array", items: { type: "string" } } } } } } },
      User: { type: "object", properties: { id: { type: "string", format: "uuid" }, email: { type: "string" }, name: { type: "string" }, phone: { type: "string", nullable: true, example: "+254712345678" } } },
      RegisterInput: { type: "object", required: ["name", "email", "password"], properties: { name: { type: "string" }, email: { type: "string", format: "email" }, phone: { type: "string", example: "0712345678" }, password: { type: "string", minLength: 8, description: "At least 8 characters with a letter and a number" } } },
      LoginInput: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email", example: "demo@fintrack.test" }, password: { type: "string", example: "Demo@1234" } } },
      Instrument: { type: "object", properties: { symbol: { type: "string", example: "SCOM" }, name: { type: "string" }, assetClass: { type: "string", enum: ["EQUITY", "FIXED_INCOME", "FUND"] }, currency: { type: "string", enum: ["KES", "USD"] }, lastPrice: { type: "number" }, priceAsOf: { type: "string", format: "date-time" } } },
      PortfolioInput: { type: "object", required: ["name", "clientName", "baseCurrency"], properties: { name: { type: "string" }, clientName: { type: "string" }, baseCurrency: { type: "string", enum: ["KES", "USD"] } } },
      Portfolio: { type: "object", properties: { id: { type: "string", format: "uuid" }, name: { type: "string" }, clientName: { type: "string" }, baseCurrency: { type: "string", enum: ["KES", "USD"] }, createdAt: { type: "string", format: "date-time" }, transactionCount: { type: "integer" }, totalValue: { type: "number" } } },
      TransactionInput: { type: "object", required: ["instrument", "type", "quantity", "unitPrice", "tradeDate"], properties: { instrument: { type: "string", example: "SCOM" }, type: { type: "string", enum: ["BUY", "SELL"] }, quantity: { type: "number", exclusiveMinimum: true, minimum: 0 }, unitPrice: { type: "number", exclusiveMinimum: true, minimum: 0 }, tradeDate: { type: "string", format: "date", example: "2026-11-01" } } },
      Transaction: { type: "object", properties: { id: { type: "string", format: "uuid" }, instrument: { type: "string" }, instrumentName: { type: "string" }, type: { type: "string", enum: ["BUY", "SELL"] }, quantity: { type: "number" }, unitPrice: { type: "number" }, amount: { type: "number" }, tradeDate: { type: "string", format: "date" }, createdAt: { type: "string", format: "date-time" } } },
      Holding: { type: "object", properties: { instrument: { type: "string" }, instrumentName: { type: "string" }, assetClass: { type: "string" }, netQuantity: { type: "number" }, averageCost: { type: "number" }, totalInvested: { type: "number" }, lastPrice: { type: "number" }, totalValue: { type: "number" }, unrealisedPnl: { type: "number" }, allocationPct: { type: "number" } } },
      Summary: { type: "object", properties: { portfolioId: { type: "string", format: "uuid" }, baseCurrency: { type: "string", enum: ["KES", "USD"] }, holdings: { type: "array", items: ref("Holding") }, totals: { type: "object", properties: { totalInvested: { type: "number" }, totalValue: { type: "number" }, unrealisedPnl: { type: "number" }, unrealisedPnlPct: { type: "number" } } } } },
    },
  },
};