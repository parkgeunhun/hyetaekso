import { Buffer } from 'node:buffer';

export const mediaTypes = {
  jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  mp4: 'video/mp4', webm: 'video/webm'
};
export const mediaKey = /^[a-f0-9-]{36}\.(jpg|png|webp|gif|mp4|webm)$/;
// Keep individual MySQL packets small, even when a video reaches the upload limit.
const partSize = 256 * 1024;

export function mediaLimit(contentType) {
  return (contentType.startsWith('video/') ? 24 : 8) * 1024 * 1024;
}

export function databaseMedia(db, legacy) {
  const find = async key => (await db.all('SELECT size,content_type FROM media_files WHERE id=?', [key]))[0];
  const metadata = row => ({size: Number(row.size), httpMetadata: {contentType: row.content_type}});
  return {
    async put(key, bytes, {httpMetadata: {contentType}, library}) {
      if (!mediaKey.test(key) || mediaTypes[key.split('.').pop()] !== contentType || !bytes.length || bytes.length > mediaLimit(contentType)) {
        throw new TypeError('Invalid media file');
      }
      const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      await db.transaction(async () => {
        await db.run('INSERT INTO media_files(id,content_type,size) VALUES(?,?,?)', [key,contentType,buffer.length]);
        if (library) await db.run('INSERT INTO media_library(file_id,label,category,created_at) VALUES(?,?,?,?)',
          [key,library.label,library.category,Date.now()]);
        for (let offset = 0; offset < buffer.length; offset += partSize) {
          const hex = buffer.subarray(offset, offset + partSize).toString('hex');
          await db.run('INSERT INTO media_chunks(file_id,part,payload) VALUES(?,?,UNHEX(?))', [key,offset / partSize,hex]);
        }
      });
    },
    async head(key) {
      const row = await find(key);
      return row ? metadata(row) : legacy?.head(key);
    },
    async get(key, options) {
      const row = await find(key);
      if (!row) return legacy?.get(key, options);
      const meta = metadata(row);
      const {offset = 0, length = meta.size} = options?.range ?? {};
      const first = Math.floor(offset / partSize);
      const last = Math.floor((offset + length - 1) / partSize);
      const rows = await db.all('SELECT payload FROM media_chunks WHERE file_id=? AND part BETWEEN ? AND ? ORDER BY part', [key,first,last]);
      const start = offset - first * partSize;
      const body = Buffer.concat(rows.map(row => row.payload)).subarray(start, start + length);
      if (body.length !== length) throw new Error('Incomplete media file');
      return {...meta, body};
    }
  };
}
