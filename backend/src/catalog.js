import { estimate } from '../../shared/quote.js';
import { digest, ApiError, invalid, choice, money, text } from './security.js';

export const joins=['기기변경','신규가입','번호이동'];
export const storageKey=value=>value.trim().replace(/^(\d+(?:\.\d+)?)\s*(GB|TB)$/i,(_,n,unit)=>n+unit.toUpperCase());
export const supportSignature=row=>digest(JSON.stringify([row.id,row.carrier_id,row.plan_id,row.fee,row.price,row.storage,row.join_type,row.source_key,row.plan_source]));
export function pickSupport(row,snapshots,now=Date.now()) {
  const snapshot=['manual','feed'].map(mode=>snapshots.find(item=>item.mode===mode)).find(item=>item&&
    item.signature===supportSignature(row)&&item.amount>=0&&item.amount<=row.price&&
    item.updated_at>0&&item.updated_at<=now+300000&&item.expires_at>now);
  return {support:snapshot?.amount??0,support_known:!!snapshot,support_source:snapshot?.source??''};
}
export function calculate(row,mode='support',months=24) {
  choice(mode,['support','contract'],'할인 유형');
  months=money(months,'할부 기간',24,36);
  if (![24,30,36].includes(months)) throw invalid('할부 기간을 확인해 주세요.');
  return estimate(row,mode,months);
}
const offerSql=`SELECT o.*, cap.product_id,cap.name AS storage,cap.price,p.name AS plan,p.fee,p.carrier_id,
 p.source_key AS plan_source,p.enabled,c.name AS carrier FROM offers o JOIN capacities cap ON cap.id=o.capacity_id
 JOIN plans p ON p.id=o.plan_id JOIN carriers c ON c.id=p.carrier_id`;
export async function offer(db,id) {
  return (await db.all(offerSql+' WHERE o.id=?',[id]))[0];
}
export async function product(db,id) {
  id=text(id,'휴대폰',64);
  const [item]=await db.all(`SELECT p.*,m.name AS manufacturer FROM products p
    JOIN manufacturers m ON m.id=p.manufacturer_id WHERE p.id=? AND p.status='published'`,[id]);
  if (!item) throw new ApiError(404,'not_found','휴대폰을 찾을 수 없습니다.');
  const rows=await db.all(offerSql+' WHERE cap.product_id=? AND p.enabled=1 AND o.extra<=cap.price',[id]);
  const snapshots=await db.all('SELECT s.* FROM supports s JOIN offers o ON o.id=s.offer_id JOIN capacities c ON c.id=o.capacity_id WHERE c.product_id=?',[id]);
  return {...item,colors:await db.all('SELECT name,image FROM colors WHERE product_id=? ORDER BY name',[id]),offers:rows.map(row=>{
    const result={...row,...pickSupport(row,snapshots.filter(s=>s.offer_id===row.id))};
    return {...result,version:digest(JSON.stringify([supportSignature(row),row.plan,row.extra,result.support,result.support_known]))};
  })};
}
export async function quote(db,input) {
  const offerId=text(input.offerId,'가격 조건',64);
  const item=await product(db,input.productId);
  const row=item.offers.find(value=>value.id===offerId);
  if (!row) throw invalid('현재 이용할 수 있는 통신사와 요금제를 선택해 주세요.');
  if (input.version && input.version!==row.version) throw new ApiError(409,'quote_changed','가격 조건이 바뀌었습니다. 상품 화면을 다시 열어 확인해 주세요.');
  return {product:item.name,productId:item.id,row,...calculate(row,input.mode,input.months)};
}
export async function listProducts(db) {
  return db.all(`SELECT p.id,p.name,p.image,p.sample,p.closed,p.manufacturer_id,m.name AS manufacturer,
    (SELECT MIN(price) FROM capacities WHERE product_id=p.id) AS price
    FROM products p JOIN manufacturers m ON m.id=p.manufacturer_id WHERE p.status='published' ORDER BY p.sort_order,p.name LIMIT 1000`);
}
