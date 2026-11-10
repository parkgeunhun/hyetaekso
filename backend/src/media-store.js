import { Buffer } from 'node:buffer';
import { ApiError } from './security.js';

export const mediaTypes = {
  jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  mp4: 'video/mp4', webm: 'video/webm'
};
export const mediaKey = /^[a-f0-9-]{36}\.(jpg|png|webp|gif|mp4|webm)$/;
// Keep individual MySQL packets small, even when a video reaches the upload limit.
const partSize = 256 * 1024;

export function mediaId(url) {
  if (!url) return null;
  try {
    const path = new URL(url,'https://hyetaekso.internal').pathname;
    const key = path.match(/^\/api\/media\/([^/]+)\/?$/)?.[1];
    return key && mediaKey.test(key) ? key : null;
  } catch {
    return null;
  }
}

export async function mediaWasDeleted(db, key) {
  return (await db.all('SELECT id FROM media_deleted WHERE id=?',[key])).length>0;
}

export async function lockMediaFiles(db, keys) {
  return db.run('UPDATE media_files SET size=size WHERE id IN ('+keys.map(()=>'?').join(',')+')',keys);
}

export async function lockMediaReferences(db, ...urls) {
  const keys = [...new Set(urls.map(mediaId).filter(Boolean))].sort();
  if (!keys.length) return;
  // File deletion and record saves serialize on the same rows. Use a write to
  // check for tombstones even if this transaction already took a read snapshot.
  const matched=await lockMediaFiles(db,keys);
  if ((matched.affectedRows ?? matched.changes)===keys.length) return;
  const deleted = await db.run('UPDATE media_deleted SET id=id WHERE id IN ('+keys.map(()=>'?').join(',')+')',keys);
  if (deleted.affectedRows ?? deleted.changes) {
    throw new ApiError(409,'media_deleted','선택한 파일이 삭제되었습니다. 보관함에서 다른 파일을 선택해 주세요.');
  }
}

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
        if (await mediaWasDeleted(db,key)) throw new ApiError(409,'media_deleted','이미 삭제된 파일입니다.');
        if (library) await db.run('INSERT INTO media_library(file_id,label,category,created_at) VALUES(?,?,?,?)',
          [key,library.label,library.category,Date.now()]);
        for (let offset = 0; offset < buffer.length; offset += partSize) {
          const part = buffer.subarray(offset, offset + partSize);
          await db.run('INSERT INTO media_chunks(file_id,part,payload) VALUES(?,?,?)', [key,offset / partSize,part]);
        }
      });
    },
    async head(key) {
      const row = await find(key);
      if (row) return metadata(row);
      if (legacy && !await mediaWasDeleted(db,key)) return legacy.head(key);
    },
    async get(key, options) {
      const row = await find(key);
      if (!row) {
        if (legacy && !await mediaWasDeleted(db,key)) return legacy.get(key,options);
        return null;
      }
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
