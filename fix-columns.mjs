#!/usr/bin/env node
/**
 * fix-columns.mjs — data repairs run by start.sh before migrations.
 * Schema changes (columns, tables, indexes) live in drizzle/ migrations;
 * this file only repairs data (old Railway domains in stored photo URLs).
 */
import mysql from 'mysql2/promise';

const url = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.log('[FixColumns] No DATABASE_URL, skipping');
  process.exit(0);
}

async function main() {
  let conn;
  try {
    conn = await mysql.createConnection(url);
    console.log('[FixColumns] Connected to database');

    // ─── Repair broken image URLs ─────────────────────────────────────────
    // Strip old Railway domain prefixes from photo URLs, leaving only /uploads/...
    console.log('[FixColumns] Repairing broken image URLs...');
    
    // 1) Fix properties.photos JSON array
    try {
      const [rows] = await conn.execute(
        "SELECT id, photos FROM properties WHERE photos IS NOT NULL AND photos LIKE '%mk-production%'"
      );
      for (const row of rows) {
        try {
          let photos = typeof row.photos === 'string' ? JSON.parse(row.photos) : row.photos;
          if (Array.isArray(photos)) {
            const fixed = photos.map(url => {
              if (typeof url === 'string' && url.includes('/uploads/')) {
                return '/uploads/' + url.split('/uploads/').pop();
              }
              return url;
            });
            await conn.execute('UPDATE properties SET photos = ? WHERE id = ?', [JSON.stringify(fixed), row.id]);
            console.log(`[FixColumns] ✅ Fixed ${fixed.length} photo URLs for property ${row.id}`);
          }
        } catch (e) {
          console.log(`[FixColumns] ⏭ Could not fix photos for property ${row.id}: ${e.message}`);
        }
      }
    } catch (err) {
      console.log('[FixColumns] ⏭ Photo URL repair (properties) skipped:', err.message);
    }
    
    // 2) Fix submission_photos.url
    try {
      await conn.execute(
        "UPDATE submission_photos SET url = CONCAT('/uploads/', SUBSTRING_INDEX(url, '/uploads/', -1)) WHERE url LIKE '%mk-production%/uploads/%'"
      );
      console.log('[FixColumns] ✅ Fixed submission_photos URLs');
    } catch (err) {
      console.log('[FixColumns] ⏭ Photo URL repair (submission_photos) skipped:', err.message);
    }
    
    // 3) Fix any other tables with old domain URLs
    try {
      await conn.execute(
        "UPDATE submission_photos SET thumbnailUrl = CONCAT('/uploads/', SUBSTRING_INDEX(thumbnailUrl, '/uploads/', -1)) WHERE thumbnailUrl LIKE '%mk-production%/uploads/%'"
      );
      await conn.execute(
        "UPDATE submission_photos SET mediumUrl = CONCAT('/uploads/', SUBSTRING_INDEX(mediumUrl, '/uploads/', -1)) WHERE mediumUrl LIKE '%mk-production%/uploads/%'"
      );
      console.log('[FixColumns] ✅ Fixed submission_photos thumbnail/medium URLs');
    } catch (err) {
      console.log('[FixColumns] ⏭ Thumbnail/medium URL repair skipped:', err.message);
    }

    console.log('[FixColumns] Done');
  } catch (err) {
    console.error('[FixColumns] Connection error:', err.message);
    // Don't fail the boot — drizzle-kit will handle it or the app will report the error
  } finally {
    if (conn) await conn.end();
  }
}

main();
