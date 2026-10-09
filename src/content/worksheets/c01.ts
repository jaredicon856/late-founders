import { FOUNDER_TYPE_COPY, ROUTES, DEFAULT_ROUTE, courseLabel, getCourse } from "../catalog";
import { asNumber, money } from "../profile";
import type { WorksheetDef } from "../types";

export const personalRoadmap: WorksheetDef = {
  assetId: "personal-roadmap",
  exports: ["pdf"],
  reads: ["founder_type", "freedom_number", "first_five_moves", "first_five_done", "ninety_day_target"],
  live: (p) => {
    const moves = Array.isArray(p.first_five_moves) ? (p.first_five_moves as string[]) : [];
    const done = Array.isArray(p.first_five_done) ? (p.first_five_done as boolean[]) : [];
    return { moves: moves.map((m, i) => ({ done: !!done[i], move: m })) };
  },
  sections: [
    {
      title: "Your founder type",
      blocks: [
        {
          kind: "computed",
          key: "type",
          label: "Founder type",
          big: true,
          compute: (_d, p) => (typeof p.founder_type === "string" ? p.founder_type : null),
        },
        {
          kind: "computed",
          key: "type_copy",
          label: "What it means",
          compute: (_d, p) => FOUNDER_TYPE_COPY[String(p.founder_type)] ?? null,
        },
      ],
    },
    {
      title: "Your Freedom Number",
      blocks: [
        {
          kind: "computed",
          key: "freedom",
          label: "Freedom Number",
          big: true,
          compute: (_d, p) => {
            const n = asNumber(p.freedom_number);
            return n ? `${money(n)}/mo` : null;
          },
        },
        {
          kind: "callout",
          tone: "note",
          text: "This is the destination, not the quit gate. Course 06 sets the separate, lower number you need before leaving a paycheck.",
        },
      ],
    },
    {
      title: "Your first five moves",
      blocks: [
        {
          kind: "table",
          table: {
            key: "moves",
            minRows: 5,
            maxRows: 5,
            columns: [
              { key: "done", label: "Done", type: "checkbox", width: 0.35 },
              { key: "move", label: "Move", type: "text", width: 5 },
            ],
          },
        },
      ],
    },
    {
      title: "Your 90-day target",
      blocks: [
        {
          kind: "computed",
          key: "target",
          label: "90-day target",
          compute: (_d, p) => (typeof p.ninety_day_target === "string" ? p.ninety_day_target : null),
        },
      ],
    },
    {
      title: "Your route",
      blocks: [
        {
          kind: "computed",
          key: "route",
          label: "Courses, in the order you take them",
          compute: (_d, p) => {
            const route = ROUTES[String(p.founder_type)] ?? DEFAULT_ROUTE;
            return {
              headers: ["#", "Course"],
              rows: route.map((n, i) => [String(i + 1), `${courseLabel(n)} · ${getCourse(n)?.title ?? ""}`]),
            };
          },
        },
      ],
    },
  ],
  readOnly: true,
};

export const course01Worksheets = [personalRoadmap];
