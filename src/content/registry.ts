// Maps every asset id to its implementation. Worksheet-type assets have a
// WorksheetDef, AI apps a ModeDef; "tool" and "library" assets have custom
// pages (Availability-Sweep, SOP Library).

import { ASSETS } from "./catalog";
import type { ModeDef, WorksheetDef } from "./types";
import { course01Worksheets } from "./worksheets/c01";
import { course02Worksheets } from "./worksheets/c02";
import { course03Worksheets } from "./worksheets/c03";
import { course04Worksheets } from "./worksheets/c04";
import { course05Worksheets } from "./worksheets/c05";
import { course12Worksheets } from "./worksheets/c12";
import { course13Worksheets } from "./worksheets/c13";
import { course14Worksheets } from "./worksheets/c14";
import { dataRoom } from "./worksheets/dataRoom";
import { course01Modes } from "./modes/c01";
import { course02Modes } from "./modes/c02";
import { course03Modes } from "./modes/c03";
import { course04Modes } from "./modes/c04";
import { course05Modes } from "./modes/c05";
import { course12Modes } from "./modes/c12";
import { course13Modes } from "./modes/c13";

const WORKSHEETS: WorksheetDef[] = [
  ...course01Worksheets,
  ...course02Worksheets,
  ...course03Worksheets,
  ...course04Worksheets,
  ...course05Worksheets,
  ...course12Worksheets,
  ...course13Worksheets,
  ...course14Worksheets,
  dataRoom,
];

const MODES: ModeDef[] = [
  ...course01Modes,
  ...course02Modes,
  ...course03Modes,
  ...course04Modes,
  ...course05Modes,
  ...course12Modes,
  ...course13Modes,
];

const worksheetById = new Map(WORKSHEETS.map((w) => [w.assetId, w]));
const modeById = new Map(MODES.map((m) => [m.assetId, m]));

export function getWorksheet(id: string): WorksheetDef | undefined {
  return worksheetById.get(id);
}

export function getMode(id: string): ModeDef | undefined {
  return modeById.get(id);
}

// Every catalog asset must have exactly one implementation. Checked in tests.
export function missingImplementations(): string[] {
  return ASSETS.filter((a) => {
    if (a.kind === "ai") return !modeById.has(a.id);
    if (a.kind === "tool" || a.kind === "library") return false;
    return !worksheetById.has(a.id);
  }).map((a) => a.id);
}
