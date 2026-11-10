import { defaultNavigation } from '../../shared/navigation.js';
import { replace } from './records.js';
import { invalid, text } from './security.js';

export async function navigation(db) {
  const [row] = await db.all("SELECT value FROM settings WHERE id='navigation'");
  return row ? JSON.parse(row.value) : defaultNavigation;
}

export async function saveNavigation(db, items) {
  const remaining = new Set(defaultNavigation.map(item => item.slug));
  if (!Array.isArray(items) || items.length !== remaining.size) throw invalid('메뉴 목록을 다시 확인해 주세요.');
  const values = items.map(item => {
    if (!item || !remaining.delete(item.slug) || typeof item.visible !== 'boolean') {
      throw invalid('메뉴 항목이나 표시 상태를 확인해 주세요.');
    }
    return {slug: item.slug, label: text(item.label, '메뉴 이름', 40), visible: item.visible};
  });
  await replace(db, 'settings', 'navigation', {value: JSON.stringify(values)});
  return values;
}
