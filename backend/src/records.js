import { officialEndpoints, officialEndpoint } from './carrier-support.js';
import { ApiError, invalid, text, money, choice, mediaUrl, pictureUrl } from './security.js';
import { joins, storageKey, offer, supportSignature } from './catalog.js';
import { lockMediaReferences } from './media-store.js';
import { validateBannerLayers } from './banner-text.js';
import { companyDocuments } from '../../shared/company-documents.js';

const string=(label,max,required=true)=>value=>text(value??'',label,max,required);
const number=(label,min,max)=>value=>money(value??0,label,min,max);
const enumOf=(label,...values)=>value=>choice(value,values,label);
const flag=value=>money(value??0,'사용 여부',0,1);
const url=value=>mediaUrl(value);
export const definitions={
  manufacturers:{name:string('제조사',100)},
  carriers:{name:string('통신사',100)},
  categories:{name:string('카테고리',100)},
  products:{manufacturer_id:string('제조사',64),name:string('모델명',160),description:string('설명',10000,false),image:pictureUrl,status:enumOf('공개 상태','draft','published'),sort_order:number('순서',0,99999),sample:flag,closed:flag},
  capacities:{product_id:string('상품',64),name:value=>storageKey(text(value,'용량',40)),price:number('출고가',1,100000000)},
  colors:{product_id:string('상품',64),name:string('색상',50),image:pictureUrl},
  plans:{carrier_id:string('통신사',64),name:string('요금제',160),fee:number('월정액'),enabled:flag,source_key:string('외부 요금제 코드',160,false)},
  offers:{capacity_id:string('용량',64),plan_id:string('요금제',64),join_type:enumOf('가입 유형',...joins),extra:number('추가 지원금'),source_key:string('외부 단말 매핑',160,false)},
  supports:{offer_id:string('상품 조건',64),amount:number('지원금'),source:string('출처',200),expires_at:number('만료 시각',1,9007199254740991)},
  banners:{title:string('배너 제목',160),body:string('설명',1000,false),alt:string('대체 문구',300,false),image:url,mobile:url,link:url,kind:enumOf('파일 종류','image','video'),fit:enumOf('크기 맞춤','cover','contain','fill'),intro:flag,enabled:flag,sort_order:number('순서',0,99999)},
  content:{kind:enumOf('콘텐츠 종류','notice','faq','review','qna','rental','page'),category:string('분류',60,false),title:string('제목',160),body:string('본문',50000),image:pictureUrl,status:enumOf('공개 상태','draft','published')},
};
export const tables=Object.keys(definitions);
export const statuses=['접수완료','상담중','상담완료','취소'];
export const defaults={
  ...officialEndpoints,
  ...companyDocuments,
  hours:'',kakao:'',intake:0,retention_days:90,banner_autoplay:0,banner_interval:6,motion:'subtle',
  join_change:'현재 통신사와 번호를 유지하고 기기만 변경합니다.',
  join_new:'새 번호로 회선을 개통합니다.',
  join_port:'번호를 유지하면서 통신사를 변경합니다.',
  help_enabled:1,help_text:'조건을 아직 정하지 않아도 상담할 수 있습니다.',
  success_text:'상담 요청이 접수되었습니다.'
};
export async function settings(db) {
  const [row]=await db.all("SELECT value FROM settings WHERE id='site'");
  return {...defaults,...(row?JSON.parse(row.value):{})};
}
export async function saveSettings(db,input) {
  const prior=await settings(db);
  const next={...prior};
  for (const [key,value] of Object.entries(defaults)) {
    if (!Object.hasOwn(input,key)) continue;
    if (key==='motion') next[key]=choice(input[key],['off','subtle','standard'],'화면 움직임');
    else if (key==='retention_days') next[key]=money(input[key],'보관 일수',1,3650);
    else if (key==='banner_interval') next[key]=money(input[key],'전환 시간',4,20);
    else if (Object.hasOwn(officialEndpoints,key)) {
      try { next[key]=String(officialEndpoint(key,input[key])); } catch { throw invalid('공식 통신사 조회 주소를 확인해 주세요.'); }
    } else if (key==='kakao') next[key]=mediaUrl(input[key]);
    else if (typeof value==='number') next[key]=flag(input[key]);
    else next[key]=text(input[key],key,50000,key==='company');
  }
  if (next.intake&&(!next.privacy||!next.consent||!next.consent_label)) throw invalid('개인정보 안내와 동의 문구를 먼저 설정해 주세요.');
  await replace(db,'settings','site',{value:JSON.stringify(next)});
  return next;
}
export async function replace(db,table,id,fields) {
  const keys=Object.keys(fields);
  if ((await db.all('SELECT id FROM '+table+' WHERE id=?',[id])).length) {
    await db.run('UPDATE '+table+' SET '+keys.map(key=>key+'=?').join(',')+' WHERE id=?',[...Object.values(fields),id]);
  } else {
    await db.run('INSERT INTO '+table+' (id,'+keys.join(',')+') VALUES ('+Array(keys.length+1).fill('?').join(',')+')',[id,...Object.values(fields)]);
  }
}
export async function saveRecord(db,table,input,id) {
  if (!Object.hasOwn(definitions,table)) throw invalid('관리 메뉴를 확인해 주세요.');
  if (!input || typeof input!=='object'||Array.isArray(input)) throw invalid('입력값을 확인해 주세요.');
  id=id?text(id,'관리 코드',64):crypto.randomUUID();
  if (!/^[\w-]+$/.test(id)) throw invalid('관리 코드를 확인해 주세요.');
  const fields=Object.fromEntries(Object.entries(definitions[table]).map(([key,parse])=>[key,parse(input[key])]));
  const layers=table==='banners'&&Object.hasOwn(input,'layers')?validateBannerLayers(input.layers):undefined;
  if (table==='banners') {
    if (fields.enabled && !fields.image) throw invalid('배너 파일을 선택해 주세요.');
    if (fields.kind==='image') {
      pictureUrl(fields.image);
      pictureUrl(fields.mobile);
    } else if (/\.(jpg|jpeg|png|webp|gif|svg)(?:[?#]|$)/i.test(fields.image)) {
      throw invalid('배너 영상 파일을 선택해 주세요.');
    }
  }
  if (table==='offers') {
    const [cap]=await db.all('SELECT price FROM capacities WHERE id=?',[fields.capacity_id]);
    const [plan]=await db.all('SELECT enabled FROM plans WHERE id=?',[fields.plan_id]);
    const prior=await offer(db,id);
    if(!plan||(!plan.enabled&&prior?.plan_id!==fields.plan_id)) throw invalid('신규 조건에는 사용 중인 요금제를 선택해 주세요.');
    if (!cap||fields.extra>cap.price) throw invalid('추가 지원금은 출고가 이하로 입력해 주세요.');
  }
  if (table==='supports') {
    const [original]=await db.all('SELECT id,mode FROM supports WHERE id=?',[id]);
    if (original?.mode==='feed') throw new ApiError(409,'automatic_support','자동 갱신 지원금은 직접 변경할 수 없습니다.');
    const row=await offer(db,fields.offer_id);
    if (!row||fields.amount>row.price||fields.expires_at<=Date.now()) throw invalid('조건, 지원금 금액과 만료 시각을 확인해 주세요.');
    const [existing]=await db.all("SELECT id FROM supports WHERE offer_id=? AND mode='manual'",[row.id]);
    if (original&&existing&&existing.id!==id) throw new ApiError(409,'duplicate_support','이 가격 조건에는 이미 수동 지원금이 있습니다.');
    if (existing) id=existing.id;
    Object.assign(fields,{mode:'manual',updated_at:Date.now(),signature:supportSignature(row)});
  }
  if (fields.image||fields.mobile||table==='banners') {
    await lockMediaReferences(db,fields.image,fields.mobile,table==='banners'?fields.link:null);
  }
  if (table==='content') fields.created_at=(await db.all('SELECT created_at FROM content WHERE id=?',[id]))[0]?.created_at??Date.now();
  await replace(db,table,id,fields);
  if (layers===null) await db.run('DELETE FROM banner_text WHERE id=?',[id]);
  else if (layers!==undefined) await replace(db,'banner_text',id,{value:JSON.stringify(layers)});
  if (table==='products'&&Array.isArray(input.categories)) {
    if (input.categories.length>30) throw invalid('카테고리는 최대 30개입니다.');
    await db.run('DELETE FROM product_categories WHERE product_id=?',[id]);
    for (const category of new Set(input.categories)) await db.run('INSERT INTO product_categories(product_id,category_id) VALUES(?,?)',[id,text(category,'카테고리',64)]);
  }
  return {id,...fields,...(layers!==undefined?{layers}:{})};
}
