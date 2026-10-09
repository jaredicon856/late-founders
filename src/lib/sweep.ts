// Availability-Sweep Agent (Course 04): domains, social handles and trademark
// hits for up to five names in one pass. It never makes the legal call and
// never reports a false clear: a check that could not run says so.

export type CheckStatus = "available" | "taken" | "unknown" | "not_run";

export interface DomainResult { domain: string; status: CheckStatus; variant: "exact" | "close" | "hyphenated" }
export interface HandleResult { platform: string; handle: string; status: CheckStatus; url: string; note?: string }
export interface TrademarkHit { mark: string; owner: string; classes: string; status: string; similarity: number }
export interface NameSweep {
  name: string;
  domains: DomainResult[];
  domainFlag: string | null; // e.g. "Only hyphenated or altered versions are free"
  handles: HandleResult[];
  trademark: { status: "done" | "not_run" | "failed"; message: string; hits: TrademarkHit[]; searchUrl: string };
}

const TIMEOUT = 8000;

async function get(url: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT), redirect: "follow", cache: "no-store" });
  } catch {
    return null;
  }
}

export function slug(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
}

export function hyphenated(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s-]/g, "").trim().split(/[\s-]+/).filter(Boolean).join("-");
}

const RDAP: Record<string, string> = {
  com: "https://rdap.verisign.com/com/v1/domain/",
  net: "https://rdap.verisign.com/net/v1/domain/",
};

// RDAP: 404 means no registration record (available); 200 means registered.
async function domainStatus(domain: string): Promise<CheckStatus> {
  const tld = domain.split(".").pop() ?? "";
  const base = RDAP[tld] ?? "https://rdap.org/domain/";
  const res = await get(base + domain, { headers: { accept: "application/rdap+json" } });
  if (!res) return "unknown";
  if (res.status === 404) return "available";
  if (res.ok) return "taken";
  return "unknown";
}

export function domainCandidates(name: string): { domain: string; variant: DomainResult["variant"] }[] {
  const s = slug(name);
  const h = hyphenated(name);
  const list: { domain: string; variant: DomainResult["variant"] }[] = [
    { domain: `${s}.com`, variant: "exact" },
    { domain: `${s}.co`, variant: "close" },
    { domain: `${s}.io`, variant: "close" },
    { domain: `get${s}.com`, variant: "close" },
    { domain: `${s}hq.com`, variant: "close" },
  ];
  if (h.includes("-")) list.push({ domain: `${h}.com`, variant: "hyphenated" });
  return list;
}

export function domainFlag(results: DomainResult[]): string | null {
  const exact = results.find((r) => r.variant === "exact");
  if (!exact || exact.status !== "taken") return null;
  const free = results.filter((r) => r.status === "available");
  if (free.length && free.every((r) => r.variant !== "exact")) {
    return `The .com is taken. Only altered versions are free (${free.map((r) => r.domain).join(", ")}), and customers who type the plain name will land somewhere else.`;
  }
  return null;
}

async function handles(name: string): Promise<HandleResult[]> {
  const h = slug(name).slice(0, 30);
  const [gh, yt] = await Promise.all([
    get(`https://api.github.com/users/${h}`, { headers: { "user-agent": "late-founders-command-center", accept: "application/vnd.github+json" } }),
    get(`https://www.youtube.com/@${h}`, { method: "HEAD" }),
  ]);
  const fromRes = (r: Response | null): CheckStatus => (!r ? "unknown" : r.status === 404 ? "available" : r.ok ? "taken" : "unknown");
  // These platforms block automated lookups; the member checks them by hand.
  const manual = (platform: string, url: string): HandleResult => ({
    platform, handle: h, url, status: "not_run", note: "This platform blocks automatic checks. Open the link to look.",
  });
  return [
    { platform: "GitHub", handle: h, url: `https://github.com/${h}`, status: fromRes(gh) },
    { platform: "YouTube", handle: h, url: `https://www.youtube.com/@${h}`, status: fromRes(yt) },
    manual("Instagram", `https://www.instagram.com/${h}/`),
    manual("X", `https://x.com/${h}`),
    manual("TikTok", `https://www.tiktok.com/@${h}`),
    manual("LinkedIn", `https://www.linkedin.com/company/${h}/`),
    manual("Facebook", `https://www.facebook.com/${h}`),
  ];
}

// Similarity 0-100 from edit distance on the normalised marks, with a bump
// for marks that contain each other. A screening aid, not a legal test.
export function similarity(a: string, b: string): number {
  const x = slug(a);
  const y = slug(b);
  if (!x || !y) return 0;
  if (x === y) return 100;
  const dp = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
  for (let j = 1; j <= y.length; j++) dp[0][j] = j;
  for (let i = 1; i <= x.length; i++)
    for (let j = 1; j <= y.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
  let score = Math.round((1 - dp[x.length][y.length] / Math.max(x.length, y.length)) * 100);
  if (x.includes(y) || y.includes(x)) score = Math.max(score, 75);
  return Math.max(0, score);
}

// Any trademark search service that answers GET {url}?q=<name> with
// { hits: [{ mark, owner, classes, status }] } and a Bearer key works.
async function trademark(name: string, category: string): Promise<NameSweep["trademark"]> {
  const searchUrl = `https://tmsearch.uspto.gov/search/search-results?query=${encodeURIComponent(name)}`;
  const url = process.env.TRADEMARK_API_URL;
  const key = process.env.TRADEMARK_API_KEY;
  if (!url || !key) {
    return {
      status: "not_run",
      message: "Trademark search isn't connected yet, so this name has NOT been cleared. Search it yourself with the link before you rely on it.",
      hits: [],
      searchUrl,
    };
  }
  const res = await get(`${url}?q=${encodeURIComponent(name)}&category=${encodeURIComponent(category)}`, {
    headers: { authorization: `Bearer ${key}`, accept: "application/json" },
  });
  if (!res?.ok) {
    return { status: "failed", message: "The trademark search didn't respond, so this name has NOT been cleared. Try again, or search with the link.", hits: [], searchUrl };
  }
  const body = (await res.json().catch(() => null)) as { hits?: { mark?: string; owner?: string; classes?: string; status?: string }[] } | null;
  if (!body || !Array.isArray(body.hits)) {
    return { status: "failed", message: "The trademark search returned something unreadable, so this name has NOT been cleared.", hits: [], searchUrl };
  }
  const hits = body.hits
    .map((h) => ({ mark: String(h.mark ?? ""), owner: String(h.owner ?? ""), classes: String(h.classes ?? ""), status: String(h.status ?? ""), similarity: similarity(name, String(h.mark ?? "")) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 15);
  return {
    status: "done",
    message: hits.length ? `${hits.length} registered or pending marks came back. Run each through the triage guide.` : "No marks came back for this exact search. Search close spellings too before you rely on it.",
    hits,
    searchUrl,
  };
}

export async function sweepName(name: string, category: string): Promise<NameSweep> {
  const cands = domainCandidates(name);
  const [statuses, hs, tm] = await Promise.all([
    Promise.all(cands.map((c) => domainStatus(c.domain))),
    handles(name),
    trademark(name, category),
  ]);
  const domains = cands.map((c, i) => ({ ...c, status: statuses[i] }));
  return { name, domains, domainFlag: domainFlag(domains), handles: hs, trademark: tm };
}
