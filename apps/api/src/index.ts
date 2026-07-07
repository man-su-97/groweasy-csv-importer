import "dotenv/config";
import express from "express";
import cors from "cors";
import { importRouter } from "./routes/import";

const app = express();
const PORT = Number(process.env.PORT || 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

app.use(cors({ origin: CORS_ORIGIN }));
// Large CSVs can be several MB of raw text in the request body.
app.use(express.json({ limit: "20mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", importRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${PORT}`);
});
