// Minimal OpenAPI spec. Add each endpoint here as you build it.
export const openapi = {
  openapi: "3.0.3",
  info: { title: "FinTrack API", version: "1.0.0", description: "Portfolio and transactions tracker" },
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
  },
  paths: {
    "/api/health": {
      get: {
        summary: "Health check",
        responses: { "200": { description: "API is running" } },
      },
    },
  },
};