import { app } from "./app";
import { config } from "./config";

app.listen(config.port, () => {
  console.log(`FinTrack API listening on http://localhost:${config.port}`);
});