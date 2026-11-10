import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { databaseMedia, mediaKey, mediaTypes } from '../backend/src/media-store.js';
import { applySchema, localDatabase } from './local-db.mjs';

const directories = process.argv.slice(2);
const defaults = ['.local/private-preview-media', '.local/media'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const db = await localDatabase();
try {
  await applySchema(db);
  const store = databaseMedia(db);
  let imported = 0;
  let verified = 0;
  for (const directory of directories.length ? directories : defaults) {
    const entries = await readdir(directory, {withFileTypes: true}).catch(error => {
      if (error.code === 'ENOENT' && !directories.length) return [];
      throw error;
    });
    for (const entry of entries) {
      const key = entry.name;
      if (!entry.isFile() || !mediaKey.test(key)) continue;
      const bytes = await readFile(join(directory, key));
      if (await store.head(key)) verified++;
      else {
        const contentType = mediaTypes[key.split('.').pop()];
        await store.put(key, bytes, {httpMetadata: {contentType}});
        imported++;
      }
      const saved = await store.get(key);
      if (hash(saved.body) !== hash(bytes)) throw new Error(`Stored media differs: ${key}`);
    }
  }

  const storedKeys = new Set((await db.all('SELECT id FROM media_files')).map(row => row.id));
  const references = await db.all(`SELECT image AS url FROM banners UNION SELECT mobile AS url FROM banners
    UNION SELECT image AS url FROM products UNION SELECT image AS url FROM colors UNION SELECT image AS url FROM content`);
  const appearance = await db.all("SELECT value FROM settings WHERE id LIKE 'appearance:%'");
  for (const row of appearance) {
    const {image, mobile} = JSON.parse(row.value);
    references.push({url: image}, {url: mobile});
  }
  const uploadedKeys = new Set(references.map(({url}) => url?.match(/^\/api\/media\/([^/?#]+)$/)?.[1]).filter(Boolean));
  const missing = [...uploadedKeys].filter(key => !storedKeys.has(key));
  console.log(JSON.stringify({imported, verified, stored: storedKeys.size, references: uploadedKeys.size, missing}));
  if (missing.length) process.exitCode = 1;
} finally {
  await db.close();
}
