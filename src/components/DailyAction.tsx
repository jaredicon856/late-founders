"use client";

import { useEffect, useState } from "react";

// Local calendar date (the member's own day), as yyyy-mm-dd.
function localDay(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DailyAction({ action, log: initial }: { action: string; log: string[] }) {
  const [log, setLog] = useState(initial);
  const [days, setDays] = useState<string[]>([]); // last 7 days, oldest first; set after mount to use the member's clock
  const [error, setError] = useState("");
  useEffect(() => {
    setDays(Array.from({ length: 7 }, (_, i) => localDay(i - 6)));
  }, []);

  const today = days[6];
  const doneToday = !!today && log.includes(today);
  const inWeek = days.filter((d) => log.includes(d)).length;

  async function toggle() {
    if (!today) return;
    const prev = log;
    const next = doneToday ? log.filter((d) => d !== today) : [...log, today];
    setLog(next);
    const res = await fetch("/api/profile/daily", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: today, done: !doneToday }),
    }).catch(() => null);
    if (!res?.ok) {
      setLog(prev);
      setError("That didn't save. Try again.");
    } else setError("");
  }

  return (
    <>
      <p style={{ margin: "6px 0 14px", fontWeight: 600 }}>{action}</p>
      <div className="daily">
        <button type="button" className={`btn-${doneToday ? "ghost" : "primary"}`} onClick={toggle} disabled={!today}>
          {doneToday ? "✓ Done today (undo)" : "I did it today"}
        </button>
        <div className="week" aria-label={`${inWeek} of the last 7 days`}>
          {days.map((d) => (
            <span key={d} className={log.includes(d) ? "on" : ""} title={d} />
          ))}
          <span className="muted small">{inWeek} of the last 7 days</span>
        </div>
      </div>
      {error && <p className="err">{error}</p>}
    </>
  );
}
