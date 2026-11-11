import { digest, token, text, choice, money, invalid, ApiError, rateLimit } from './security.js';
import { quote, product } from './catalog.js';
import { settings, statuses } from './records.js';
import { consultationEmailNotice, serviceReceiptCodes, serviceTypes } from '../../shared/consultation.js';

function phoneNumber(value) {
  const phone=text(value,'전화번호',20).replace(/[\s-]/g,'');
  if (!/^01[016789]\d{7,8}$/.test(phone)) throw invalid('휴대폰 번호를 확인해 주세요.');
  return phone;
}
function birthDate(value) {
  const birth=text(value,'생년월일',10,false);
  if (!birth) return '';
  const date=new Date(birth);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)||!Number.isFinite(+date)||date.toISOString().slice(0,10)!==birth||birth>new Date(Date.now()+32400000).toISOString().slice(0,10)) throw invalid('생년월일을 확인해 주세요.');
  return birth;
}
function emailAddress(value) {
  const email=text(value??'','이메일',254,false);
  if(email&&!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email))throw invalid('이메일 주소를 확인해 주세요.');
  return email;
}
function leadRequestKey(value) {
  const key=text(value,'요청 번호',64);
  if (!/^[a-z0-9-]{32,64}$/i.test(key)) throw invalid('요청 번호를 확인해 주세요.');
  return key;
}
export function newLeadReceipt(service,createdAt) {
  const koreanTime=new Date(createdAt+9*3600000).toISOString().slice(0,19).replace(/\D/g,'');
  const randomCode=token().slice(0,16).toUpperCase();
  return 'HT-'+serviceReceiptCodes[service]+koreanTime+'-'+randomCode;
}
async function insertLead(db,{requestKey,service,name,phone,email='',birth='',details,status='접수완료',snapshot={},consent,createdAt}) {
  const id=crypto.randomUUID(),receipt=newLeadReceipt(service,createdAt);
  await db.run(
    'INSERT INTO leads(id,receipt,request_key,service,name,phone,email,birth,details,status,notes,quote,consent,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [id,receipt,requestKey,service,name,phone,email,birth,details,status,'',JSON.stringify(snapshot),JSON.stringify(consent),createdAt]
  );
  return {id,receipt};
}
export async function submitLead(db,request,input) {
  await rateLimit(db,request,'lead',12,3600000);
  const config=await settings(db);
  if (!config.intake) throw new ApiError(503,'intake_closed','현재 온라인 상담 접수를 준비하고 있습니다.');
  const service=choice(input.service,serviceTypes,'상담 유형');
  const phone=phoneNumber(input.phone), name=text(input.name,'이름',80);
  const email=emailAddress(input.email),phoneQuote=service==='휴대폰'&&Boolean(input.productId);
  if(phoneQuote&&(name.length<2||name.length>40)) throw invalid('이름은 2~40자로 입력해 주세요.');
  if(input.offerId&&!phoneQuote)throw invalid('상담할 휴대폰을 선택해 주세요.');
  const birth=birthDate(input.birth??'');
  if (phoneQuote&&!birth) throw invalid('생년월일을 입력해 주세요.');
  if (input.consent!==true) throw invalid('개인정보 수집·이용 동의를 확인해 주세요.');
  const requestKey=leadRequestKey(input.requestKey);
  const [previous]=await db.all('SELECT receipt,phone FROM leads WHERE request_key=?',[requestKey]);
  if (previous) {
    if(previous.phone!==phone) throw new ApiError(409,'request_conflict','새로고침 후 다시 시도해 주세요.');
    return {receipt:previous.receipt,message:config.success_text};
  }
  let snapshot={};
  if (phoneQuote) {
    const item=await product(db,input.productId);
    if (item.sample||item.closed) throw invalid('이 상품은 상담 접수가 불가능합니다.');
    if (input.offerId) {
      if (!input.version) throw invalid('견적을 확인한 후 신청해 주세요.');
      snapshot=await quote(db,input);
    } else {
      if (!config.help_enabled) throw invalid('가격 조건을 선택해 주세요.');
      const fields=['carrier','join_type','storage','plan_id'];
      const selected={};
      for(const field of fields)if(input.selection?.[field])selected[field]=text(input.selection[field],'휴대폰 조건',100);
      const matching=item.offers.find(row=>Object.entries(selected).every(([key,value])=>row[key]===value));
      if(Object.keys(selected).length&&!matching)throw invalid('선택한 조건을 다시 확인해 주세요.');
      snapshot={product:item.name,productId:item.id,help:true,selected:{...selected,...(selected.plan_id?{plan:matching.plan,fee:matching.fee}:{})}};

    }
    if (input.color && !item.colors.some(color=>color.name===input.color)) throw invalid('색상 선택을 확인해 주세요.');
    snapshot.color=input.color??'';
    for (const key of ['penalty','balance']) {
      snapshot[key]=choice(input[key],['yes','no'],'남은 금액 여부');
      if (snapshot[key]==='yes'&&input[key+'Amount']!==''&&input[key+'Amount']!=null) snapshot[key+'Amount']=money(input[key+'Amount'],'남은 금액',1);
    }
  }
  if(phoneQuote) {
    const row=snapshot.row??snapshot.selected??{};
    const won=value=>typeof value==='number'?value.toLocaleString('ko-KR')+'원':'';
    const remainder=key=>snapshot[key]==='no'?'없음':(won(snapshot[key+'Amount'])||'있음 · 금액 미입력');
    const parts=[
      ['모델',snapshot.product],['색상',snapshot.color],['구매 통신사',row.carrier],['가입 유형',row.join_type],['용량',row.storage],['요금제',row.plan],['월정액',won(row.fee)],
      ['할인 방식',snapshot.mode==='support'?'공통지원금':snapshot.mode==='contract'?'선택약정 25%':''],['할부 기간',snapshot.months?snapshot.months+'개월':''],
      ['단말기 출고가',won(row.price)],['공통지원금',snapshot.pending?'확인 중':won(snapshot.support)],['추가 지원금',won(row.extra)],['월 예상 납부액',won(snapshot.monthly)],
      ['남은 위약금',remainder('penalty')],['남은 할부금',remainder('balance')]
    ];
    snapshot.summary=parts.filter(([,value])=>value).map(([label,value])=>label+': '+value).join('\n');
  }
  const details=text(input.details??'','상담 내용',3000,false);
  const createdAt=Date.now();
  const consent={text:config.consent,label:config.consent_label,privacy:config.privacy,agreedAt:createdAt,
    ...(email?{emailNotice:consultationEmailNotice}:{})};
  try {
    const {receipt}=await insertLead(db,{requestKey,service,name,phone,email,birth,details,snapshot,consent,createdAt});
    return {receipt,message:config.success_text};
  } catch(error) {
    const [existing]=await db.all('SELECT receipt,phone FROM leads WHERE request_key=?',[requestKey]);
    if (existing?.phone===phone) return {receipt:existing.receipt,message:config.success_text};
    throw error;
  }
}
export async function createManualLead(db,input,username) {
  const service=choice(input.service,serviceTypes,'상담 유형');
  const name=text(input.name,'이름',80);
  const phone=phoneNumber(input.phone);
  const email=emailAddress(input.email);
  const details=text(input.details??'','상담 내용',3000,false);
  const status=choice(input.status??'접수완료',statuses,'상담 상태');
  const requestKey=digest('manual-lead:'+username+':'+leadRequestKey(input.requestKey));
  const createdAt=Date.now();
  const consent={source:'manual',registeredBy:username,registeredAt:createdAt};
  try {
    return await insertLead(db,{requestKey,service,name,phone,email,details,status,consent,createdAt});
  } catch(error) {
    const [prior]=await db.all('SELECT id,receipt,service,name,phone,email,details FROM leads WHERE request_key=?',[requestKey]);
    if (!prior) throw error;
    if (prior.service!==service||prior.name!==name||prior.phone!==phone||prior.email!==email||prior.details!==details) {
      throw new ApiError(409,'request_conflict','이 등록 요청은 이미 저장되었습니다. 상담 목록에서 확인해 주세요.');
    }
    return {id:prior.id,receipt:prior.receipt};
  }
}
export async function deleteLeads(db,ids) {
  if(!Array.isArray(ids)||!ids.length||ids.length>50) throw invalid('한 번에 상담 1~50건을 선택해 주세요.');
  const keys=[...new Set(ids.map(id=>text(id,'상담 관리 번호',64)))];
  const result=await db.run('DELETE FROM leads WHERE id IN ('+keys.map(()=>'?').join(',')+')',keys);
  return {deleted:result.affectedRows??result.changes};
}
export async function lookupLead(db,request,input) {
  await rateLimit(db,request,'lookup',10,900000);
  const [row]=await db.all('SELECT receipt,service,status,created_at FROM leads WHERE receipt=? AND phone=?',
    [text(input.receipt,'신청번호',64).toUpperCase(),phoneNumber(input.phone)]);
  if (!row) throw new ApiError(404,'not_found','신청번호와 전화번호를 확인해 주세요.');
  return row;
}
export async function updateLead(db,id,input) {
  const status=choice(input.status,statuses,'상담 상태');
  const notes=text(input.notes??'','관리 메모',5000,false);
  const result=await db.run('UPDATE leads SET status=?,notes=? WHERE id=?',[status,notes,id]);
  if (!(result.affectedRows??result.changes) && !(await db.all('SELECT id FROM leads WHERE id=?',[id])).length) {
    throw new ApiError(404,'not_found','상담 내역을 찾을 수 없습니다.');
  }
  return {id,status,notes};
}
