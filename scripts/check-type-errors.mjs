#!/usr/bin/env node
// Runs `tsc --noEmit` and fails if the number of type errors is ABOVE the
// recorded baseline. The codebase has existing errors; this stops new ones
// while they are fixed. When you fix errors, lower the number in
// scripts/type-error-baseline.txt (CI tells you the new count).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const baseline = Number(readFileSync(new URL("./type-error-baseline.txt", import.meta.url), "utf8").trim());
const r = spawnSync("npx", ["tsc", "--noEmit"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
const errors = out.split("\n").filter((l) => /error TS\d+/.test(l));
const count = errors.length;

console.log(`TypeScript errors: ${count} (baseline ${baseline})`);
if (count > baseline) {
  console.error(`\n✖ ${count - baseline} new type error(s). Fix them before merging.`);
  console.error("Errors in this run (new ones are among these):\n");
  console.error(errors.join("\n"));
  process.exit(1);
}
if (count < baseline) {
  console.log(`✔ ${baseline - count} fewer than baseline. Lower scripts/type-error-baseline.txt to ${count}.`);
}
