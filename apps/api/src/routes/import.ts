import { Router, Request, Response } from "express";
import { parseCsv } from "../services/csvParser";
import { mapRowsToCrm } from "../services/aiMapper";
import { sanitizeBatch } from "../services/validate";
import { ImportResult } from "../types/crm";

export const importRouter = Router();

interface ImportRequestBody {
  csv?: string;
}

importRouter.post("/import", async (req: Request<unknown, unknown, ImportRequestBody>, res: Response) => {
  const { csv } = req.body;

  if (!csv || typeof csv !== "string" || csv.trim() === "") {
    return res.status(400).json({ error: "Request body must include a non-empty 'csv' string field." });
  }

  let rows;
  try {
    rows = parseCsv(csv);
  } catch (err) {
    return res.status(400).json({
      error: `Could not parse CSV: ${err instanceof Error ? err.message : "unknown error"}`,
    });
  }

  if (rows.length === 0) {
    return res.status(400).json({ error: "CSV has no data rows." });
  }

  let mapped;
  try {
    mapped = await mapRowsToCrm(rows);
  } catch (err) {
    return res.status(502).json({
      error: `AI mapping failed: ${err instanceof Error ? err.message : "unknown error"}`,
    });
  }

  const { imported, skipped: sanitizeSkipped } = sanitizeBatch(mapped);
  // rows dropped by a failed batch count as skipped too
  const droppedByAi = rows.length - mapped.length;
  const skipped = sanitizeSkipped + Math.max(0, droppedByAi);

  const result: ImportResult = {
    imported,
    skipped,
    total: rows.length,
  };

  res.json(result);
});
