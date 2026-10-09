"use client";

import { useState } from "react";

export default function FirstFive({ moves, done: initial }: { moves: string[]; done: boolean[] }) {
  const [done, setDone] = useState(() => moves.map((_, i) => !!initial[i]));
  const [error, setError] = useState("");

  async function toggle(i: number) {
    const next = done.map((d, j) => (j === i ? !d : d));
    setDone(next);
    const res = await fetch("/api/profile/moves", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ done: next }),
    });
    if (!res.ok) {
      setDone(done);
      setError("That didn't save. Try again.");
    } else setError("");
  }

  return (
    <>
      <ul className="moves">
        {moves.map((m, i) => (
          <li key={i} className={done[i] ? "done" : ""}>
            <button className={done[i] ? "on" : ""} onClick={() => toggle(i)} aria-pressed={done[i]} aria-label={`Mark "${m}" ${done[i] ? "not done" : "done"}`}>
              {done[i] ? "✓" : ""}
            </button>
            <span>{m}</span>
          </li>
        ))}
      </ul>
      {error && <p className="err">{error}</p>}
    </>
  );
}
