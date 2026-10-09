import JSZip from "jszip";
import { DATA_ROOM_FOLDERS } from "@/content/worksheets/dataRoom";
import type { RenderDoc } from "@/lib/docs/types";
import { renderPdf } from "./pdf";

// Five empty folders with a branded README.pdf each, and the quarterly review
// checklist at the root.
export async function renderDataRoomZip(checklist: RenderDoc): Promise<Uint8Array> {
  const zip = new JSZip();
  const root = zip.folder("Data Room")!;
  for (const [i, f] of DATA_ROOM_FOLDERS.entries()) {
    const readme = await renderPdf({
      title: `${f.name} folder`,
      eyebrow: "COURSE 13 · THE 10-YEAR BUILD-TO-SELL PLAN · DATA ROOM",
      purpose: f.purpose,
      blocks: [
        { type: "heading", text: "What belongs in this folder" },
        { type: "bullets", items: f.items, style: "checkbox" },
        { type: "callout", tone: "note", text: "Leave the folder empty until you have the real document. The gap is the point." },
      ],
    });
    root.folder(`${i + 1} ${f.name}`)!.file("README.pdf", readme);
  }
  root.file("0 Quarterly review checklist.pdf", await renderPdf(checklist));
  return zip.generateAsync({ type: "uint8array" });
}
