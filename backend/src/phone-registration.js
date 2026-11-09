import { saveRecord } from './records.js';
import { ApiError, invalid, text } from './security.js';

function rows(value, max, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max || value.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw invalid(label + '은(는) 최대 ' + max + '개까지 등록할 수 있습니다.');
  }
  return value;
}

export async function registerPhone(db, input) {
  const id = text(input.requestKey, '등록 요청 번호', 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw invalid('등록 요청 번호를 확인해 주세요.');
  }
  const capacities = rows(input.capacities, 20, '용량');
  const colors = rows(input.colors, 30, '색상');
  const offers = rows(input.offers, 200, '가격 조건');

  return db.transaction(async () => {
    const [existing] = await db.all('SELECT id FROM products WHERE id=?', [id]);
    if (existing) throw new ApiError(409, 'already_registered', '이미 저장한 요청입니다. 휴대폰 목록에서 확인해 주세요.');

    const product = await saveRecord(db, 'products', input.product, id);
    const capacityIds = new Map();
    for (const row of capacities) {
      const key = text(row.key, '용량 연결 번호', 64);
      if (capacityIds.has(key)) throw invalid('중복된 용량 연결 번호가 있습니다.');
      const capacity = await saveRecord(db, 'capacities', {...row, product_id: product.id});
      capacityIds.set(key, capacity.id);
    }
    for (const row of colors) {
      await saveRecord(db, 'colors', {...row, product_id: product.id});
    }
    for (const row of offers) {
      const capacityId = capacityIds.get(row.capacityKey);
      if (!capacityId) throw invalid('가격 조건에 연결할 용량을 선택해 주세요.');
      await saveRecord(db, 'offers', {...row, capacity_id: capacityId});
    }
    return {id: product.id, name: product.name};
  });
}
