"use client";

import { useEffect, useState } from "react";

// Members in the Americas see their own clock. Anyone else (or a browser that
// hides its zone) gets US Eastern time, so the greeting always reads as US time.
function greetingZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (tz.startsWith("America/") || tz === "Pacific/Honolulu") return tz;
  } catch {}
  return "America/New_York";
}

export default function Greeting({ name }: { name: string }) {
  const [word, setWord] = useState("Welcome back");
  useEffect(() => {
    const h = Number(
      new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: greetingZone() }).format(new Date()),
    );
    setWord(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);
  return (
    <>
      {word}, {name}
    </>
  );
}
