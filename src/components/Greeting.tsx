"use client";

import { useEffect, useState } from "react";

// Uses the member's own clock; the server's time zone would be wrong.
export default function Greeting({ name }: { name: string }) {
  const [word, setWord] = useState("Welcome back");
  useEffect(() => {
    const h = new Date().getHours();
    setWord(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);
  return (
    <>
      {word}, {name}
    </>
  );
}
