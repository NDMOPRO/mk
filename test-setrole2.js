// Test the exact regex from the current handleOpsSetRole handler
const regex = /^@?(\S+)\s+(CEO|Manager|Staff)$/i;

function extractCommandArgs(text, command) {
  if (!text) return "";
  const re = new RegExp(`^\\/(?:${command})(?:@\\S+)?\\s*`, "i");
  return text.replace(re, "").trim();
}

const tests = [
  "/setrole @SAQ198 Manager",
  "/setrole @SAQ198 manager",
  "/setrole @SAQ198 MANAGER",
  "/setrole @SAQ198 Manger",    // typo: missing 'a'
  "/setrole @SAQ198 manger",    // typo lowercase
  "/setrole @SAQ198 Maneger",   // typo: extra 'e'
  "/setrole @SAQ198 Mangaer",   // typo
  "/setrole @SAQ198 CEO",
  "/setrole @SAQ198 Staff",
  "/setrole SAQ198 Manager",    // without @
  "/setrole@monthlykey_bot @SAQ198 Manager",  // with bot mention
  "/setrole@monthlykey_bot @SAQ198 Manger",   // with bot mention + typo
];

console.log("=== Current regex test ===");
for (const t of tests) {
  const args = extractCommandArgs(t, "setrole");
  const m = args.match(regex);
  const status = m ? `✅ user=${m[1]} role=${m[2]}` : `❌ NO MATCH`;
  console.log(`  ${t.padEnd(50)} args="${args}" -> ${status}`);
}

// Now test the fuzzy role matcher we'll add
function normalizeRole(input) {
  if (!input) return null;
  const s = input.toLowerCase().trim();
  // Exact matches (case-insensitive)
  if (s === "ceo") return "CEO";
  if (s === "manager") return "Manager";
  if (s === "staff") return "Staff";
  // Common typos for Manager
  const managerTypos = ["manger", "maneger", "mangaer", "mangger", "managar", "managr", "manaer", "maanger", "mnager", "manegr"];
  if (managerTypos.includes(s)) return "Manager";
  // Common typos for CEO
  const ceoTypos = ["ceo", "coo", "c.e.o", "c.o.o"];
  if (ceoTypos.includes(s)) return "CEO";
  // Common typos for Staff
  const staffTypos = ["staf", "staaf", "stff", "satff", "staf"];
  if (staffTypos.includes(s)) return "Staff";
  // Levenshtein distance fallback for close matches
  function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) =>
      Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[a.length][b.length];
  }
  const candidates = [["CEO", "ceo"], ["Manager", "manager"], ["Staff", "staff"]];
  for (const [label, canonical] of candidates) {
    if (levenshtein(s, canonical) <= 2) return label;
  }
  return null;
}

// New regex: accept any non-space word as role, then fuzzy-match it
const newRegex = /^@?(\S+)\s+(\S+)$/;

console.log("\n=== New fuzzy regex test ===");
for (const t of tests) {
  const args = extractCommandArgs(t, "setrole");
  const m = args.match(newRegex);
  if (!m) { console.log(`  ${t.padEnd(50)} -> ❌ NO MATCH`); continue; }
  const role = normalizeRole(m[2]);
  const status = role ? `✅ user=${m[1].replace(/^@/, "")} role=${role}` : `❌ Unknown role "${m[2]}"`;
  console.log(`  ${t.padEnd(50)} -> ${status}`);
}
