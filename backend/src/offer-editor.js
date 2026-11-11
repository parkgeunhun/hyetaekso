import { offerEditLimit,offerTitle } from '../../shared/offer-editor.js';
import { definitions,saveRecord } from './records.js';
import { ApiError,invalid,text } from './security.js';

const offerNames='cap.name AS storage, pr.name AS product_name, p.name AS plan, c.name AS carrier';
const offerTables=`FROM offers o JOIN capacities cap ON cap.id=o.capacity_id JOIN products pr ON pr.id=cap.product_id
  JOIN plans p ON p.id=o.plan_id JOIN carriers c ON c.id=p.carrier_id`;
const namedOffers=`SELECT o.*, cap.product_id, cap.price, p.fee, p.enabled, p.carrier_id, ${offerNames} ${offerTables}`;

export function listAdminOffers(db) {
  return db.all(`${namedOffers}
    ORDER BY pr.sort_order,pr.name,cap.price,cap.name,c.name,p.fee,p.name,o.join_type,o.id LIMIT 2000`);
}

export function listAdminSupports(db) {
  return db.all(`SELECT s.*, o.join_type, ${offerNames} ${offerTables}
    JOIN supports s ON s.offer_id=o.id ORDER BY pr.name,cap.price,cap.name,c.name,p.name,o.join_type,s.mode,s.id LIMIT 2000`);
}

const fields=Object.entries(definitions.offers);
function values(input) {
  if(!input||typeof input!=='object'||Array.isArray(input)||fields.some(([key])=>!Object.hasOwn(input,key))) {
    throw invalid('가격 조건의 필수 항목을 확인해 주세요.');
  }
  return Object.fromEntries(fields.map(([key,parse])=>[key,parse(input[key])]));
}

const matches=(row,expected)=>fields.every(([key])=>row[key]===expected[key]);

export async function saveOfferChanges(db,changes) {
  if(!Array.isArray(changes)||!changes.length||changes.length>offerEditLimit) {
    throw invalid('한 번에 1~'+offerEditLimit+'개 가격 조건을 저장할 수 있습니다.');
  }
  const edits=changes.map(change=>{
    const id=text(change?.id,'가격 조건',64);
    if(!/^[\w-]+$/.test(id)) throw invalid('가격 조건을 확인해 주세요.');
    return {id,before:values(change.before),after:values(change.after)};
  });
  const ids=[...new Set(edits.map(({id})=>id))].sort();
  if(ids.length!==edits.length) throw invalid('중복된 가격 조건이 있습니다.');
  const placeholders=ids.map(()=>'?').join(',');
  return db.transaction(async()=>{
    // Lock the existing rows before comparing snapshots or updating any condition.
    await db.run('UPDATE offers SET extra=extra WHERE id IN ('+placeholders+')',ids);
    const current=new Map((await db.all(namedOffers+' WHERE o.id IN ('+placeholders+')',ids)).map(row=>[row.id,row]));
    for(const {id,before,after} of edits) {
      const row=current.get(id);
      if(!row) throw new ApiError(409,'offer_changed','수정 중인 가격 조건이 삭제되었습니다. 목록을 새로 열어 확인해 주세요.');
      const title=offerTitle(row);
      if(matches(row,after)) continue;
      if(!matches(row,before)) throw new ApiError(409,'offer_changed',title+' 조건이 다른 곳에서 변경되었습니다. 목록을 새로 열어 확인해 주세요.');
      try {
        await saveRecord(db,'offers',after,id);
      } catch(error) {
        if(error instanceof ApiError) throw new ApiError(error.status,error.code,title+' · '+error.message);
        if(/duplicate|unique constraint/i.test(error.message??'')) {
          throw new ApiError(409,'offer_duplicate',title+' · 같은 기기·용량·요금제·가입 유형의 조건이 이미 있습니다.');
        }
        throw error;
      }
    }
    return {saved:edits.length};
  });
}
