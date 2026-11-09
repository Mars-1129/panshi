import type { StageRunner } from "../types.ts"
import { runStage0 } from "./s0.ts"
import { runStage1 } from "./s1.ts"
import { runStage2 } from "./s2.ts"
import { runStage3 } from "./s3.ts"
import { runStage4 } from "./s4.ts"
import { runStage5 } from "./s5.ts"
import { runStage6 } from "./s6.ts"
import { runStage7 } from "./s7.ts"
import { runStage8 } from "./s8.ts"
import { runStage9 } from "./s9.ts"

export const STAGE_RUNNERS: Record<number, StageRunner> = {
  0: runStage0,
  1: runStage1,
  2: runStage2,
  3: runStage3,
  4: runStage4,
  5: runStage5,
  6: runStage6,
  7: runStage7,
  8: runStage8,
  9: runStage9,
}
