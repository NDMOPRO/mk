/**
 * One-time migration: Set Riyadh as active, all others as coming soon (isActive=false)
 * Run after deploy: DATABASE_URL="..." node update-cities-status.mjs
 */
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL required"); process.exit(1); }

const pool = mysql.createPool(DATABASE_URL);

try {
  // Set all cities to inactive first
  await pool.execute("UPDATE cities SET is_active = 0");
  console.log("[Migration] All cities set to inactive (coming soon).");

  // Set only Riyadh to active
  const [result] = await pool.execute("UPDATE cities SET is_active = 1 WHERE name_en = 'Riyadh'");
  console.log(`[Migration] Riyadh set to active. Rows affected: ${result.affectedRows}`);

  // Verify
  const [rows] = await pool.execute("SELECT name_en, name_ar, is_active FROM cities ORDER BY sort_order");
  console.log("\n[Verification] Current city status:");
  rows.forEach(r => console.log(`  ${r.name_en} (${r.name_ar}): ${r.is_active ? 'ACTIVE' : 'Coming Soon'}`));

  console.log("\nDone!");
} catch (err) {
  console.error("Error:", err.message);
} finally {
  await pool.end();
}
