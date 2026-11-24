// Runs before every test file, so config.ts finds the env vars it requires.
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";