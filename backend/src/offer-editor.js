import { offerEditLimit,offerCode } from '../../shared/offer-editor.js';
import { definitions,saveRecord } from './records.js';
import { ApiError,invalid,text } from './security.js';

export function listAdminOffers(db) {
  return db.all(`SELECT o.*, cap.product_id, cap.name AS storage, cap.price, pr.name AS product_name,
    p.name AS plan, p.fee, p.enabled, p.carrier_id, c.name AS carrier
    FROM offers o JOIN capacities cap ON cap.id=o.capacity_id JOIN products pr ON pr.id=cap.product_id
    JOIN plans p ON p.id=o.plan_id JOIN carriers c ON c.id=p.carrier_id
    ORDER BY pr.sort_order,pr.name,cap.price,cap.name,c.name,p.fee,p.name,o.join_type,o.id LIMIT 2000`);
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
    const id=text(change?.id,'관리 코드',64);
    if(!/^[\w-]+$/.test(id)) throw invalid('가격 조건의 관리 코드를 확인해 주세요.');
    try {
      return {id,before:values(change.before),after:values(change.after)};
    } catch(error) {
      if(error instanceof ApiError) throw invalid(offerCode(id)+' · '+error.message);
      throw error;
    }
  });
  const ids=[...new Set(edits.map(({id})=>id))].sort();
  if(ids.length!==edits.length) throw invalid('중복된 가격 조건이 있습니다.');
  const placeholders=ids.map(()=>'?').join(',');
  return db.transaction(async()=>{
    // Lock the existing rows before comparing snapshots or updating any condition.
    await db.run('UPDATE offers SET extra=extra WHERE id IN ('+placeholders+')',ids);
    const current=new Map((await db.all('SELECT * FROM offers WHERE id IN ('+placeholders+')',ids)).map(row=>[row.id,row]));
    for(const {id,before,after} of edits) {
      const row=current.get(id),code=offerCode(id);
      if(!row) throw new ApiError(409,'offer_changed',code+' 조건이 삭제되었습니다. 목록을 새로 열어 확인해 주세요.');
      if(matches(row,after)) continue;
      if(!matches(row,before)) throw new ApiError(409,'offer_changed',code+' 조건이 다른 곳에서 변경되었습니다. 목록을 새로 열어 확인해 주세요.');
      try {
        await saveRecord(db,'offers',after,id);
      } catch(error) {
        if(error instanceof ApiError) throw new ApiError(error.status,error.code,code+' · '+error.message);
        if(/duplicate|unique constraint/i.test(error.message??'')) {
          throw new ApiError(409,'offer_duplicate',code+' · 같은 기기·용량·요금제·가입 유형의 조건이 이미 있습니다.');
        }
        throw error;
      }
    }
    return {saved:edits.length};
  });
}
