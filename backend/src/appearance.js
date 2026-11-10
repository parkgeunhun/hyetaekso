import { appearanceSlotByKey } from '../../shared/site-appearance.js';
import { ApiError, invalid, pictureUrl, text } from './security.js';
import { replace } from './records.js';
import { lockMediaReferences } from './media-store.js';
import { validateBannerLayers } from './banner-text.js';

const prefix = 'appearance:';

function getSlot(key) {
  const slot = appearanceSlotByKey.get(key);
  if (!slot) throw new ApiError(404, 'not_found', '편집할 이미지나 배너 위치를 찾을 수 없습니다.');
  return slot;
}

export async function appearance(db) {
  const rows = await db.all("SELECT id, value FROM settings WHERE id LIKE 'appearance:%'");
  const values = [];
  for (const row of rows) {
    const key = row.id.slice(prefix.length);
    if (appearanceSlotByKey.has(key)) values.push([key, JSON.parse(row.value)]);
  }
  return Object.fromEntries(values);
}

export async function saveAppearance(db, key, input) {
  const slot = getSlot(key);
  const values = slot.textOnly ? {} : {image: pictureUrl(input.image)};
  if (slot.mobile) values.mobile = pictureUrl(input.mobile);
  for (const [field, label, fallback, max] of slot.fields ?? []) {
    values[field] = text(input[field] ?? fallback ?? '', label, max, false);
  }
  if (slot.hero) {
    if (Object.hasOwn(input,'layers')) values.layers=validateBannerLayers(input.layers);
    else {
      // Older clients update the image and named fields without sending a layout.
      const [existing]=await db.all('SELECT value FROM settings WHERE id=?',[prefix+key]);
      if (existing) values.layers=JSON.parse(existing.value).layers;
    }
    if (!Array.isArray(values.layers)&&!values.headline&&!values.subtitle) throw invalid('배너 제목을 한 줄 이상 입력해 주세요.');
  }
  if (Object.hasOwn(values,'title') && !values.title) throw invalid('카드 제목을 입력해 주세요.');
  await lockMediaReferences(db, values.image, values.mobile);
  await replace(db, 'settings', prefix + key, {value: JSON.stringify(values)});
  return values;
}

export async function resetAppearance(db, key) {
  getSlot(key);
  await db.run('DELETE FROM settings WHERE id=?', [prefix + key]);
  return {ok: true};
}
