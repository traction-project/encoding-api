import { Router } from "express";
import { readFileSync } from "fs";

import APIRouter from "./api";

const router = Router();
router.use("/api", APIRouter);

router.get("/revision", (_, res) => {
  try {
    const REVISION = readFileSync("REVISION").toString().trim();
    res.send(REVISION);
  } catch {
    res.send("unknown");
  }
});

export default router;
