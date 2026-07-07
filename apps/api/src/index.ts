import "dotenv/config";
import express from "express";
import cors from "cors";
import { importRouter } from "./routes/import";

const app = express();
const PORT = Number(process.env.PORT || 4000);
// strip trailing slash so it matches the browser's Origin header exactly
const CORS_ORIGIN = (process.env.CORS_ORIGIN || "http://localhost:3000").replace(/\/+$/, "");

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: "20mb" })); // large CSVs can be a few MB as raw text

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
