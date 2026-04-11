/**
 * Test ops command argument extraction
 * Verifies /command and /command@botname both work correctly
 */

function extractCommandArgs(text, command) {
  if (!text) return "";
  const re = new RegExp(`^\\/(?:${command})(?:@\\S+)?\\s*`, "i");
  return text.replace(re, "").trim();
}

const tests = [
  // [input, command, expectedOutput]
  ["/task complete database of companies", "task", "complete database of companies"],
  ["/task@monthlykey_bot complete database of companies", "task", "complete database of companies"],
  ["/checklist@monthlykey_bot item1 | item2 | item3", "checklist", "item1 | item2 | item3"],
  ["/done 5", "done", "5"],
  ["/done@monthlykey_bot 5", "done", "5"],
  ["/remind 9am morning standup", "remind", "9am morning standup"],
  ["/remind@monthlykey_bot 2h follow up with client", "remind", "2h follow up with client"],
  ["/task", "task", ""],  // empty args — should show usage
  ["/checklist@monthlykey_bot", "checklist", ""],  // empty args
];

let passed = 0;
let failed = 0;

tests.forEach(([text, cmd, expected]) => {
  const result = extractCommandArgs(text, cmd);
  const ok = result === expected;
  if (ok) {
    passed++;
    console.log("PASS  " + text.substring(0, 50).padEnd(50) + " => \"" + result + "\"");
  } else {
    failed++;
    console.log("FAIL  " + text.substring(0, 50).padEnd(50) + " => \"" + result + "\" (expected: \"" + expected + "\")");
  }
});

console.log("\n" + passed + "/" + (passed + failed) + " tests passed");
if (failed > 0) process.exit(1);
