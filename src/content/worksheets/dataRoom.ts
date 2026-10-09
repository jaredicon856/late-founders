import type { WorksheetDef } from "../types";

// The five folders and what belongs in each. The zip export ships these as
// empty folders with a branded README.pdf in each, plus the quarterly review
// checklist at the root. Empty is deliberate: the gaps show every time the
// member opens the directory.
export const DATA_ROOM_FOLDERS: { name: string; purpose: string; items: string[] }[] = [
  {
    name: "Financial",
    purpose: "What a buyer uses to check that the earnings are real and repeatable.",
    items: [
      "Three years of profit and loss statements and balance sheets",
      "Three years of business tax returns",
      "Monthly revenue by client for the last 24 months",
      "Accounts receivable and payable aging reports",
      "Bank statements for the business account, last 12 months",
      "Add-backs schedule: owner salary, one-off and personal expenses, with evidence",
      "Current year budget and forecast",
      "Debt schedule: loans, lines of credit, leases, with balances and terms",
    ],
  },
  {
    name: "Legal",
    purpose: "Proof the business exists, is in good standing, and has no surprises waiting.",
    items: [
      "Formation documents and any amendments",
      "Operating agreement or bylaws, and cap table",
      "Certificate of good standing (current)",
      "Every client contract and master services agreement",
      "Supplier, vendor and lease agreements",
      "Licences and permits",
      "Insurance policies and claims history",
      "Any past or pending disputes, with outcomes",
    ],
  },
  {
    name: "Operational",
    purpose: "Evidence the business runs without you.",
    items: [
      "SOP Library export, organised by role",
      "Business dashboard: metrics, ranges and owners",
      "Org chart with who decides what",
      "Key systems and software list, with account owners",
      "Client list with tenure, revenue share and contract status",
      "Records of every week you were away and what happened",
    ],
  },
  {
    name: "IP",
    purpose: "What the business owns, and proof that it owns it.",
    items: [
      "Trademark registrations and applications",
      "Domain names and registrar account details",
      "Copyrighted materials, templates and course content",
      "Signed IP assignment from every employee and contractor",
      "Software licences and any custom code ownership",
      "Brand sheet and logo files",
    ],
  },
  {
    name: "HR",
    purpose: "Who works here, on what terms, and what a buyer inherits.",
    items: [
      "Team list: role, start date, pay, employee or contractor",
      "Employment and contractor agreements",
      "Role scorecards for every position",
      "Benefits, retirement plans and payroll provider",
      "Non-compete, non-solicit and confidentiality agreements",
      "Handbook and policies",
    ],
  },
];

export const dataRoom: WorksheetDef = {
  assetId: "data-room",
  exports: ["zip", "pdf"],
  sections: [
    {
      title: "How the data room works",
      blocks: [
        {
          kind: "prose",
          paragraphs: [
            "Download the zip below and unpack it into your own Drive, Dropbox or SharePoint. You get five empty folders, each with a one-page README that lists exactly what belongs inside, plus the quarterly review checklist at the top level.",
            "Leave the folders empty until you have the real document. An empty folder is a gap you can see every time you open the directory, and closing those gaps is the work.",
          ],
        },
        ...DATA_ROOM_FOLDERS.map((f) => ({
          kind: "prose" as const,
          heading: f.name,
          paragraphs: [f.purpose],
          bullets: f.items,
        })),
      ],
    },
    {
      title: "Quarterly review",
      intro: "Once a quarter, open every folder and tick what is complete and current.",
      blocks: [
        {
          kind: "fields",
          fields: [
            { key: "owner", label: "Review owner", type: "text", width: "half" },
            { key: "next_review", label: "Next review date", type: "date", width: "half" },
            {
              key: "cadence",
              label: "Recurring",
              type: "select",
              options: ["Every quarter", "Every month"],
              width: "half",
            },
          ],
        },
        {
          kind: "checklist",
          key: "review",
          mode: "check",
          notes: true,
          items: DATA_ROOM_FOLDERS.map((f) => ({
            key: f.name.toLowerCase(),
            label: `${f.name}: every item present and current`,
          })),
        },
        {
          kind: "computed",
          key: "completeness",
          label: "Folders complete this quarter",
          compute: (d) => {
            const r = (d.review as Record<string, { done?: boolean }>) ?? {};
            const done = DATA_ROOM_FOLDERS.filter((f) => r[f.name.toLowerCase()]?.done).length;
            return `${done} of ${DATA_ROOM_FOLDERS.length}`;
          },
        },
      ],
    },
  ],
};
