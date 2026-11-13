import assert from 'node:assert/strict';
import {handleApi} from '../backend/src/api.js';
import {databaseMedia} from '../backend/src/media-store.js';
import {saveRecord,saveSettings} from '../backend/src/records.js';
import {saveAppearance} from '../backend/src/appearance.js';
import {passwordHash} from '../backend/src/security.js';

export async function visitorScenario(db) {
  const origin='https://preview.example';
  // Old deployments may still supply this flag; it must not require shoppers to sign in.
  const env={APP_ORIGIN:origin,PRIVATE_PREVIEW:true};
  const request=(path,method='GET',body,headers={})=>handleApi(new Request(origin+'/api'+path,{
    method,headers:{origin,'content-type':'application/json','cf-connecting-ip':'198.51.100.23',...headers},body:body?JSON.stringify(body):undefined
  }),env,db);
  const files={};
  const bytes=Buffer.from([255,216,255,217]);
  for(const name of ['cover','color','draftCover','draftColor','banner','draftBanner','article','draftArticle','appearance','unused','foreign']){
    const key=crypto.randomUUID()+'.jpg';
    await databaseMedia(db).put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});
    files[name]='/media/'+key;
  }
  const videoKey=crypto.randomUUID()+'.mp4';
  await databaseMedia(db).put(videoKey,Buffer.from('0123456789'),{httpMetadata:{contentType:'video/mp4'}});
  files.video='/media/'+videoKey;
  const url=name=>'/api'+files[name];
  const manufacturer=await saveRecord(db,'manufacturers',{name:'방문자 검증 제조사'});
  const product=await saveRecord(db,'products',{manufacturer_id:manufacturer.id,name:'방문자 공개 모델',status:'published',image:origin+url('cover')+'?v=1'});
  const hidden=await saveRecord(db,'products',{manufacturer_id:manufacturer.id,name:'방문자 비공개 모델',status:'draft',image:url('draftCover')});
  await saveRecord(db,'products',{manufacturer_id:manufacturer.id,name:'외부 사진 참조 모델',status:'published',image:'https://other.example'+url('foreign')});
  await saveRecord(db,'colors',{product_id:product.id,name:'블랙',image:url('color')});
  await saveRecord(db,'colors',{product_id:hidden.id,name:'미공개 색상',image:url('draftColor')});
  const carrier=await saveRecord(db,'carriers',{name:'방문자 통신사'});
  const plan=await saveRecord(db,'plans',{carrier_id:carrier.id,name:'방문자 요금제',fee:59000,enabled:1});
  const capacity=await saveRecord(db,'capacities',{product_id:product.id,name:'256GB',price:1000000});
  await saveRecord(db,'offers',{capacity_id:capacity.id,plan_id:plan.id,join_type:'번호이동',extra:100000});
  await saveRecord(db,'banners',{title:'공개 배너',kind:'video',fit:'cover',enabled:1,image:url('video'),mobile:url('banner')});
  await saveRecord(db,'banners',{title:'비공개 배너',kind:'image',fit:'cover',enabled:0,image:url('draftBanner')});
  const published=await saveRecord(db,'content',{kind:'faq',title:'방문자 질문',body:'방문자 답변',status:'published',image:url('article')});
  const unpublished=await saveRecord(db,'content',{kind:'faq',title:'비공개 질문',body:'비공개 답변',status:'draft',image:url('draftArticle')});
  await saveAppearance(db,'logo',{image:url('appearance')});

  const catalog=await request('/products');
  assert.equal(catalog.status,200);
  const items=(await catalog.json()).items;
  assert.ok(items.some(item=>item.id===product.id));
  assert.ok(!items.some(item=>item.id===hidden.id));
  const response=await request('/products/'+product.id);
  assert.equal(response.status,200);
  const detail=await response.json();
  assert.equal(detail.colors[0].image,url('color'));
  assert.equal(detail.offers[0].plan,'방문자 요금제');
  assert.equal((await request('/products/'+hidden.id)).status,404);

  await saveSettings(db,{intake:1});
  const siteResponse=await request('/site');
  assert.equal(siteResponse.status,200);
  const site=await siteResponse.json();
  assert.equal(site.settings.intake,1);
  assert.ok(site.settings.privacy&&site.settings.consent&&site.settings.join_change);
  assert.equal(Object.hasOwn(site.settings,'retention_days'),false);
  assert.ok(site.banners.every(row=>row.enabled===1));
  assert.equal(site.appearance.logo.image,url('appearance'));
  const content=await request('/content/faq');
  assert.equal(content.status,200);
  assert.ok((await content.json()).some(row=>row.id===published.id));
  assert.equal((await request('/content/faq/'+unpublished.id)).status,404);
  assert.equal((await request('/content/faq/'+published.id)).status,200);

  for(const name of ['cover','color','banner','article','appearance']) {
    const image=await request(files[name]);
    assert.equal(image.status,200,name);
    assert.equal(image.headers.get('cache-control'),'private, no-store');
    assert.deepEqual(Buffer.from(await image.arrayBuffer()),bytes);
    assert.equal((await request(files[name],'HEAD')).status,200);
  }
  const video=await request(files.video,'GET',undefined,{Range:'bytes=0-1'});
  assert.equal(video.status,206);
  assert.equal(await video.text(),'01');
  for(const name of ['draftCover','draftColor','draftBanner','draftArticle','unused','foreign']) {
    assert.equal((await request(files[name])).status,404,name);
    assert.equal((await request(files[name],'HEAD')).status,404,name);
  }

  const input={productId:product.id,offerId:detail.offers[0].id,version:detail.offers[0].version,mode:'contract',months:24};
  const quote=await request('/quote','POST',input);
  assert.equal(quote.status,200);
  assert.equal((await quote.json()).product,product.name);
  assert.equal((await request('/quote','POST',input,{origin:'https://other.example'})).status,403);
  const inquiry={...input,service:'휴대폰',name:'방문자 검증',phone:'01000000000',birth:'2000-01-01',
    color:'블랙',penalty:'no',balance:'no',requestKey:crypto.randomUUID(),consent:true};
  const submitted=await request('/consultations','POST',inquiry);
  assert.equal(submitted.status,201);
  const {receipt}=await submitted.json();
  assert.match(receipt,/^HT-A/);
  const lookup=await request('/consultations/lookup','POST',{receipt,phone:inquiry.phone});
  assert.equal(lookup.status,200);
  assert.equal(Object.hasOwn(await lookup.json(),'phone'),false);
  assert.equal((await request('/consultations/lookup','POST',{receipt,phone:'01099999999'})).status,404);
  for(const path of ['/admin/session','/admin/leads','/admin/settings','/admin/media','/admin/products','/admin/excel/products']) {
    assert.equal((await request(path)).status,401,path);
  }
  assert.equal((await request('/admin/products/'+product.id,'PUT',{...product,name:'변경 시도'})).status,401);
  assert.equal((await request('/admin/leads','DELETE',{ids:[crypto.randomUUID()]})).status,401);

  const username='visitor-admin-'+crypto.randomUUID(),password=crypto.randomUUID();
  await db.run('INSERT INTO accounts(id,username,password_hash) VALUES(?,?,?)',[crypto.randomUUID(),username,await passwordHash(password)]);
  const login=await request('/admin/login','POST',{username,password});
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await request(files.unused,'GET',undefined,{cookie})).status,200);
  assert.equal((await request('/admin/logout','POST',{}, {cookie})).status,200);
  assert.equal((await request(files.unused)).status,404);
  await saveRecord(db,'products',{...product,status:'draft'},product.id);
  assert.equal((await request('/products/'+product.id)).status,404);
  assert.equal((await request(files.cover)).status,404);
  assert.equal((await request(files.color)).status,404);
}

