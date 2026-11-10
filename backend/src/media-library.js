import { mediaCategories, isVideoUrl } from '../../shared/media-library.js';
import { appearance } from './appearance.js';
import { appearanceSlotByKey } from '../../shared/site-appearance.js';
import { ApiError, choice, invalid, text } from './security.js';
import { lockMediaFiles, mediaId, mediaKey } from './media-store.js';

const categories = Object.keys(mediaCategories);
const libraryPageSize = 24;
const builtIn = [
  ['/media/showroom.png', '기본 홈 배너', 'banner'],
  ['/media/logo.svg', '혜택소 로고·탭 아이콘', 'other'],
  ['/media/services.png', '서비스 페이지 공용 이미지', 'other'],
  ...Array.from({length:4}, (_, i) => ['/media/phone-'+i+'.svg', '기본 휴대폰 이미지 '+(i+1), 'phone'])
];

export function mediaDetails(label, category) {
  return {label: text(label, '파일 이름', 160), category: choice(category, categories, '이미지 분류')};
}

async function mediaReferences(db) {
  const references = await db.all(`SELECT image AS url, title AS label, 'banner' AS category, kind, '홈 배너' AS location FROM banners WHERE image<>''
    UNION ALL SELECT mobile, title, 'banner', 'image', '홈 배너' FROM banners WHERE mobile<>''
    UNION ALL SELECT link, title, 'banner', 'link', '홈 배너 이동 주소' FROM banners WHERE link LIKE '%/api/media/%'
    UNION ALL SELECT image, name, 'phone', 'image', '휴대폰 상품' FROM products WHERE image<>''
    UNION ALL SELECT c.image, p.name, 'phone', 'image', '휴대폰 색상' FROM colors c JOIN products p ON c.product_id=p.id WHERE c.image<>''
    UNION ALL SELECT image, title, CASE WHEN category='service:mobility' THEN 'car' ELSE 'other' END, 'image', '게시물' FROM content WHERE image<>''`);
  for (const [key, values] of Object.entries(await appearance(db))) {
    const group = key.startsWith('mobility-') ? 'car' : key.endsWith('-hero') ? 'banner' : 'other';
    const slot = appearanceSlotByKey.get(key);
    for (const url of [values.image, values.mobile]) if (url) references.push({url,label:slot.label,category:group,location:slot.group+' 화면'});
  }
  return references;
}

export async function listMedia(db, params) {
  const category = choice(params.get('category') ?? 'all', ['all', ...categories], '이미지 분류');
  const kind = choice(params.get('kind') ?? 'all', ['all','image','video'], '파일 유형');
  const query = text(params.get('q') ?? '', '검색어', 160, false).toLowerCase();
  const page = Math.max(0, Number.parseInt(params.get('page') ?? '0', 10) || 0);
  const files = await db.all(`SELECT f.id, f.content_type, l.label, l.category, l.created_at
    FROM media_files f LEFT JOIN media_library l ON l.file_id=f.id ORDER BY l.created_at DESC,f.id`);
  const references = await mediaReferences(db);
  const usedIds = new Set(references.map(reference=>mediaId(reference.url)).filter(Boolean));

  const used = new Map();
  for (const reference of references) if (reference.kind!=='link'&&!used.has(reference.url)) used.set(reference.url, reference);
  const items = new Map();
  for (const file of files) {
    const url = '/api/media/'+file.id;
    const reference = used.get(url);
    items.set(url, {
      id:file.id,url,label:file.label || reference?.label || file.id,
      category:file.category || reference?.category || 'other',
      kind:file.content_type.startsWith('video/')?'video':'image',source:'upload',inUse:usedIds.has(file.id)
    });
  }
  for (const [url,label,group] of builtIn) items.set(url,{url,label,category:group,kind:'image',source:'builtin'});
  for (const {url,label,category,kind} of used.values()) {
    if (!items.has(url)) items.set(url,{url,label,category,kind:kind==='video'||isVideoUrl(url)?'video':'image',source:'reference'});
  }
  const matches = [...items.values()].filter(item =>
    (category==='all'||item.category===category) && (kind==='all'||item.kind===kind) &&
    (item.label.toLowerCase().includes(query)||item.url.toLowerCase().includes(query)));
  const start = page * libraryPageSize;
  return {items:matches.slice(start,start+libraryPageSize),more:matches.length>start+libraryPageSize};
}

export async function updateMedia(db, id, input) {
  if (!mediaKey.test(id)) throw new ApiError(404,'not_found','이미지 보관함에서 파일을 찾을 수 없습니다.');
  const details = mediaDetails(input.label,input.category);
  await db.transaction(async () => {
    await lockMediaFiles(db,[id]);
    const [file] = await db.all('SELECT id FROM media_files WHERE id=?',[id]);
    if (!file) throw new ApiError(404,'not_found','이미지 보관함에서 파일을 찾을 수 없습니다.');
    const [saved] = await db.all('SELECT file_id FROM media_library WHERE file_id=?',[id]);
    if (saved) await db.run('UPDATE media_library SET label=?,category=? WHERE file_id=?',[details.label,details.category,id]);
    else await db.run('INSERT INTO media_library(file_id,label,category,created_at) VALUES(?,?,?,?)',
      [id,details.label,details.category,Date.now()]);
  });
  return details;
}

export async function deleteMedia(db, input) {
  if (!Array.isArray(input)||!input.length||input.length>50||input.some(id=>typeof id!=='string'||!mediaKey.test(id))) {
    throw invalid('삭제할 업로드 파일을 1개 이상 선택해 주세요.');
  }
  const ids = [...new Set(input)].sort();
  return db.transaction(async () => {
    await lockMediaFiles(db,ids);
    const placeholders = ids.map(()=>'?').join(',');
    const files = await db.all('SELECT id FROM media_files WHERE id IN ('+placeholders+')',ids);
    if (!files.length) return {deleted:0};
    const target = new Set(files.map(file=>file.id));
    const used = (await mediaReferences(db)).filter(reference=>target.has(mediaId(reference.url)));
    if (used.length) {
      const places = [...new Set(used.map(({location,label})=>location+' · '+label))];
      const shown = places.slice(0,3).join(', ');
      throw new ApiError(409,'media_in_use','사용 중인 파일입니다. '+shown+(places.length>3?' 외 '+(places.length-3)+'곳':'')+'에서 연결을 해제한 후 삭제해 주세요.');
    }
    for (const file of files) await db.run('INSERT INTO media_deleted(id) VALUES(?)',[file.id]);
    await db.run('DELETE FROM media_files WHERE id IN ('+placeholders+')',ids);
    return {deleted:files.length};
  });
}
