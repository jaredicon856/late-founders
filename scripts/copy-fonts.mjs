// Copies the Montserrat TTFs used by the web UI and the PDF exporter into
// src/fonts (PDF exporter) and public/fonts (web UI). Run once after install (npm run fonts); the files are committed.
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const weights = ["400Regular", "600SemiBold", "700Bold", "900Black"];
const root = path.resolve("node_modules/@expo-google-fonts/montserrat");
const outs = [path.resolve("src/fonts"), path.resolve("public/fonts")];
for (const o of outs) mkdirSync(o, { recursive: true });

for (const w of weights) {
  const dir = path.join(root, w);
  const file = readdirSync(dir).find((f) => f.endsWith(".ttf"));
  if (!file) throw new Error(`No TTF for ${w}`);
  for (const o of outs) copyFileSync(path.join(dir, file), path.join(o, `Montserrat-${w}.ttf`));
  console.log(`copied ${file}`);
}
