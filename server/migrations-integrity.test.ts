import { describe, it, expect } from "vitest";
import fs from "fs";

// Guards for defects that kept migrations from running on MySQL. See
// drizzle/0023-0027 and the PRs that fixed the migration pipeline.
const journal = JSON.parse(fs.readFileSync("drizzle/meta/_journal.json", "utf-8")) as {
  entries: { idx: number; tag: string; when: number }[];
};
const read = (tag: string) => fs.readFileSync(`drizzle/${tag}.sql`, "utf-8");
const code = (sql: string) => sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

describe("drizzle migrations", () => {
  it("every journal entry has its .sql file, and every .sql file is in the journal", () => {
    const files = fs.readdirSync("drizzle").filter((f) => /^\d{4}_.*\.sql$/.test(f)).map((f) => f.replace(/\.sql$/, ""));
    const tags = journal.entries.map((e) => e.tag);
    expect(files.sort()).toEqual([...tags].sort());
  });

  it("every migration from 0023 on is newer than all migrations before it", () => {
    // The migrator only applies entries newer than the last applied one, so an
    // entry with an older timestamp is silently skipped forever. That already
    // happened to 0021 and 0022 (their columns exist; both files are guarded).
    const first = journal.entries.findIndex((e) => e.tag.startsWith("0023_"));
    for (let i = first; i < journal.entries.length; i++) {
      const before = Math.max(...journal.entries.slice(0, i).map((e) => e.when));
      expect(journal.entries[i].when, journal.entries[i].tag).toBeGreaterThan(before);
    }
  });

  it("no MariaDB-only syntax (MySQL has no ADD COLUMN / CREATE INDEX IF NOT EXISTS)", () => {
    for (const { tag } of journal.entries) {
      const sql = code(read(tag));
      expect(sql, tag).not.toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/i);
      expect(sql, tag).not.toMatch(/CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS/i);
    }
  });

  it("each statement is separated by a breakpoint, and comments never contain the marker", () => {
    for (const { tag } of journal.entries) {
      const raw = read(tag);
      for (const line of raw.split("\n")) {
        if (line.trim().startsWith("--") && !line.trim().startsWith("--> statement-breakpoint")) {
          expect(line, tag).not.toContain("statement-breakpoint");
        }
      }
      for (const chunk of raw.split("--> statement-breakpoint")) {
        const statements = code(chunk).split(";").filter((s) => s.trim());
        expect(statements.length, `${tag}: several statements without a breakpoint`).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("startup code does not change the schema", () => {
  it("server/db/connection.ts, server/shomoos.ts and fix-columns.mjs contain no DDL", () => {
    for (const f of ["server/db/connection.ts", "server/shomoos.ts", "fix-columns.mjs"]) {
      const src = fs.readFileSync(f, "utf-8");
      expect(src, f).not.toMatch(/\b(ALTER\s+TABLE|CREATE\s+TABLE|CREATE\s+(UNIQUE\s+)?INDEX|DROP\s+TABLE)\b/i);
    }
  });
});
