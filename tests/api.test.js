import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { sqlite,applySchema } from '../scripts/local-db.mjs';
import { connectMysql } from '../backend/src/db.js';
import { handleApi } from '../backend/src/api.js';
import { passwordHash } from '../backend/src/security.js';
import { saveRecord } from '../backend/src/records.js';

const origin='http://127.0.0.1:5173',env={APP_ORIGIN:origin,LOCAL_DEV:true};
async function scenario(db) {
  let session='';
  const request=async(path,method='GET',body,customOrigin=origin)=>{
    const response=await handleApi(new Request(origin+'/api'+path,{method,headers:{origin:customOrigin,cookie:session,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}),env,db);
    const type=response.headers.get('content-type');
    return {status:response.status,response,data:type?.includes('application/json')?await response.json():await response.arrayBuffer()};
  };
  assert.equal((await request('/admin/products')).status,401);
  const user='test-'+crypto.randomUUID().slice(0,8),password=crypto.randomUUID();
  await db.run('INSERT INTO accounts(id,username,password_hash) VALUES(?,?,?)',[crypto.randomUUID(),user,await passwordHash(password)]);
  assert.equal((await request('/admin/login','POST',{username:user,password},'https://wrong.test')).status,403);
  assert.equal((await request('/admin/login','POST',{username:user,password:'wrong'})).status,401);
  await db.run('INSERT INTO accounts(id,username,password_hash) VALUES(?,?,?)',[crypto.randomUUID(),'malformed-hash','invalid']);
  assert.equal((await request('/admin/login','POST',{username:'malformed-hash',password})).status,401);
  const login=await request('/admin/login','POST',{username:user,password});
  assert.equal(login.status,200);
  const cookie=login.response.headers.get('set-cookie');
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);session=cookie.split(';')[0];
  assert.equal((await request('/admin/session')).data.username,user);
  const manufacturer=(await request('/admin/manufacturers','POST',{name:'검증 제조사'})).data;
  const carrier=(await request('/admin/carriers','POST',{name:'검증 통신사'})).data;
  const product=(await request('/admin/products','POST',{manufacturer_id:manufacturer.id,name:'검증 휴대폰',status:'published'})).data;
  const updated=await request('/admin/products/'+product.id,'PUT',{...product,name:'검증 휴대폰 수정'});
  assert.equal(updated.status,200);
  assert.equal((await request('/products')).data.items[0].name,'검증 휴대폰 수정');
  const cap=await saveRecord(db,'capacities',{product_id:product.id,name:'256 GB',price:1000001});
  const plan=await saveRecord(db,'plans',{carrier_id:carrier.id,name:'검증 요금제',fee:69001,enabled:1});
  const offer=await saveRecord(db,'offers',{capacity_id:cap.id,plan_id:plan.id,join_type:'번호이동',extra:180000});
  const manual=await saveRecord(db,'supports',{offer_id:offer.id,source:'검증',amount:310000,expires_at:Date.now()+86400000});
  const feedId=crypto.randomUUID();
  await db.run('INSERT INTO supports(id,offer_id,mode,amount,source,updated_at,expires_at,signature) VALUES(?,?,?,?,?,?,?,?)',
    [feedId,offer.id,'feed',100000,'자동 갱신',manual.updated_at,manual.expires_at,manual.signature]);
  assert.equal((await request('/admin/supports/'+feedId,'PUT',manual)).status,409);
  assert.equal((await request('/admin/supports/'+feedId,'DELETE')).status,409);
  assert.equal((await db.all('SELECT mode FROM supports WHERE id=?',[feedId]))[0]?.mode,'feed');
  assert.equal((await request('/admin/settings','PUT',{intake:1})).status,400);
  assert.equal((await request('/admin/settings','PUT',{company:'혜택소 검증',hours:'평일 10:00~18:00',intake:1,privacy:'시험 안내',consent:'시험 동의'})).status,200);
  const banner=await request('/admin/banners','POST',{title:'검증 배너',image:'/media/showroom.png',kind:'image',fit:'cover',enabled:1});
  assert.equal(banner.status,201);
  const site=(await request('/site')).data;
  assert.equal(site.settings.hours,'평일 10:00~18:00');
  assert.equal(site.banners[0].image,'/media/showroom.png');
  assert.equal((await request('/admin/appearance/unknown','PUT',{image:'/media/showroom.png'})).status,404);
  assert.equal((await request('/admin/appearance/home-hero','PUT',{image:'/media/movie.mp4'})).status,400);
  const appearance=await request('/admin/appearance/home-hero','PUT',{image:'/media/showroom.png',mobile:'/media/services.png',headline:'관리자 편집 배너'});
  assert.equal(appearance.status,200);
  const publicAppearance=(await request('/site')).data.appearance['home-hero'];
  assert.equal(publicAppearance.headline,'관리자 편집 배너');
  assert.equal(publicAppearance.mobile,'/media/services.png');
  assert.equal((await request('/admin/appearance/home-hero','DELETE')).status,200);
  assert.equal((await request('/site')).data.appearance['home-hero'],undefined);
  const current=(await request('/products/'+product.id)).data.offers[0];
  const selection={productId:product.id,offerId:offer.id,version:current.version,mode:'support',months:24};
  assert.equal((await request('/quote','POST',selection)).data.monthly,90252);
  assert.equal((await request('/quote','POST',{...selection,mode:'contract',months:30})).data.monthly,79085);
  assert.equal((await request('/quote','POST',{...selection,version:'stale'})).status,409);
  assert.equal((await request('/quote','POST',{...selection,months:12})).status,400);
  assert.equal((await request('/quote','POST',{...selection,months:[24]})).status,400);
  assert.equal((await request('/quote','POST',{offerId:offer.id})).status,400);
  const lead={...selection,name:'시험 고객',phone:'01000000000',birth:'1990-01-01',consent:true,service:'휴대폰',requestKey:crypto.randomUUID(),penalty:'no',balance:'no'};
  assert.equal((await request('/consultations','POST',{...lead,consent:false})).status,400);
  const created=await request('/consultations','POST',lead);
  assert.equal(created.status,201);
  assert.equal((await request('/consultations','POST',lead)).data.receipt,created.data.receipt);
  const list=(await request('/admin/leads')).data.items;
  assert.equal(list.length,1);
  const detail=(await request('/admin/leads/'+list[0].id)).data;
  assert.equal(JSON.parse(detail.quote).monthly,90252);
  assert.match(JSON.parse(detail.quote).summary,/월 예상 납부액: 90,252원/);
  assert.equal(JSON.parse(detail.consent).text,'시험 동의');
  const change={status:'상담중',notes:'처리 중'};
  assert.equal((await request('/admin/leads/'+crypto.randomUUID(),'PATCH',change)).status,404);
  assert.equal((await request('/admin/leads/'+list[0].id,'PATCH',change)).status,200);
  assert.equal((await request('/consultations/lookup','POST',{receipt:created.data.receipt,phone:lead.phone})).data.status,'상담중');
  assert.equal((await request('/consultations/lookup','POST',{receipt:created.data.receipt,phone:'01000000001'})).status,404);
  const file=await request('/admin/excel/manufacturers');
  assert.equal(file.status,200);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(file.data));
  workbook.getWorksheet('manufacturers').getCell('B2').value='일괄 변경 제조사';
  const input={file:Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64')};
  const preview=await request('/admin/excel/manufacturers','POST',input);
  assert.equal(preview.status,200);
  assert.equal((await request('/admin/manufacturers')).data[0].name,'검증 제조사');
  assert.equal((await request('/admin/excel/manufacturers','POST',{...input,apply:true,fingerprint:'bad'})).status,400);
  assert.equal((await request('/admin/excel/manufacturers','POST',{...input,apply:'false',fingerprint:preview.data.fingerprint})).status,400);
  assert.equal((await request('/admin/manufacturers')).data[0].name,'검증 제조사');
  assert.equal((await request('/admin/excel/manufacturers','POST',{...input,apply:true,fingerprint:preview.data.fingerprint})).data.applied,true);
  assert.equal((await request('/admin/manufacturers')).data[0].name,'일괄 변경 제조사');
  assert.equal((await request('/admin/products/'+product.id,'DELETE')).status,200);
  assert.equal((await request('/products/'+product.id)).status,404);
  const category=await saveRecord(db,'categories',{name:'일괄 등록 검증'});
  const registration={
    requestKey:crypto.randomUUID(),
    product:{manufacturer_id:manufacturer.id,name:'일괄 등록 휴대폰',status:'published',categories:[category.id]},
    capacities:[{key:'256',name:'256 GB',price:1200000}],
    colors:[{name:'검증 색상',image:'/media/phone-0.svg'}],
    offers:[{capacityKey:'256',plan_id:plan.id,join_type:'기기변경',extra:150000}]
  };
  const invalidRegistration={...registration,offers:[{...registration.offers[0],capacityKey:'missing'}]};
  assert.equal((await request('/admin/phone-registration','POST',invalidRegistration)).status,400);
  assert.equal((await request('/products/'+registration.requestKey)).status,404);
  const registered=await request('/admin/phone-registration','POST',registration);
  assert.equal(registered.status,201);
  assert.equal((await request('/admin/phone-registration','POST',registration)).status,409);
  const savedPhone=(await request('/products/'+registered.data.id)).data;
  assert.equal(savedPhone.offers[0].storage,'256GB');
  assert.equal(savedPhone.offers[0].price,1200000);
  assert.equal(savedPhone.colors[0].name,'검증 색상');
  const savedAdminPhone=(await request('/admin/products')).data.find(item=>item.id===registered.data.id);
  assert.deepEqual(savedAdminPhone.categories,[category.id]);
  await request('/admin/logout','POST');
  assert.equal((await request('/admin/leads')).status,401);
}
test('SQLite API workflow and workbook',async()=>{const db=await sqlite(':memory:');try{await scenario(db);}finally{db.close();}});
test('MySQL-compatible database API workflow',{skip:!process.env.MYSQL_TEST_URL},async()=>{
  const db=await connectMysql(process.env.MYSQL_TEST_URL);
  try {await applySchema(db);await scenario(db);}finally{await db.close();}
});
