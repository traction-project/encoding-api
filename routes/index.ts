import { Router } from "express";
import { readFileSync } from "fs";

import APIRouter from "./api";

const router = Router();

// Mount APIRouter under /api
router.use("/api", APIRouter);

/**
 * Returns the contents of the file REVISION in order to check the current
 * version of the API. If no such file is found, the string `unknown` is
 * returned.
 */
router.get("/revision", (_, res) => {
  try {
    // Try to read contents of file REVISION and return to client
    const REVISION = readFileSync("REVISION").toString().trim();
    res.send(REVISION);
  } catch {
    // Send string `unknown` if file could not be read
    res.send("unknown");
  }
});

export default router;
