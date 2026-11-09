import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const types = {jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm'};

export async function localMedia(folder) {
  if (folder) await mkdir(folder, {recursive: true});
  const memory = new Map();
  const metadata = key => ({contentType: types[key.split('.').pop()]});
  return {
    async put(key, bytes) {
      if (folder) await writeFile(join(folder, key), bytes);
      else memory.set(key, Buffer.from(bytes));
    },
    async head(key) {
      try {
        const size = folder ? (await stat(join(folder, key))).size : memory.get(key)?.length;
        return size === undefined ? null : {size, httpMetadata: metadata(key)};
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },
    async get(key, options) {
      try {
        const bytes = folder ? await readFile(join(folder, key)) : memory.get(key);
        if (!bytes) return null;
        const range = options?.range;
        return {
          size: bytes.length,
          body: range ? bytes.subarray(range.offset, range.offset + range.length) : bytes,
          httpMetadata: metadata(key)
        };
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    }
  };
}
