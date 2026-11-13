import assert from 'node:assert/strict';
import {supportCatalog,previewSupport,importSupport} from '../backend/src/support-setup.js';
import {saveRecord} from '../backend/src/records.js';
import {product} from '../backend/src/catalog.js';
import {supportSyncStatus,syncSupports,syncHistory} from '../backend/src/sync.js';
import {supportSelection,supportFetcher} from './fixtures/support-source.js';

export async function supportSetupScenario(db) {
  const fetcher=supportFetcher();
  const list=await supportCatalog(db,supportSelection,fetcher);
  assert.deepEqual(list.models,[{id:'SM-S931N',name:'갤럭시 S25'}]);
  assert.deepEqual(list.plans,[{id:'NATM000110',name:'컴팩트'}]);
  const preview=await previewSupport(db,supportSelection,fetcher);
  assert.equal(preview.price,1155000);assert.equal(preview.fee,39000);
  assert.deepEqual(preview.supports.map(row=>row.amount),[265000,265000,355000]);
  const input={...supportSelection,version:preview.version,requestKey:crypto.randomUUID()};
  await assert.rejects(importSupport(db,{...input,version:'outdated'},fetcher),error=>error.code==='source_changed');
  const saved=await importSupport(db,input,fetcher);
  assert.equal(saved.status,'draft');assert.equal(saved.offers.length,3);
  assert.deepEqual(await importSupport(db,input,fetcher),saved);
  const [phone]=await db.all('SELECT * FROM products WHERE id=?',[saved.id]);
  assert.equal(phone.sample,0);
  await saveRecord(db,'products',{...phone,status:'published'},phone.id);
  let detail=await product(db,phone.id);
  assert.ok(detail.offers.every(row=>row.support_known&&row.source_key.startsWith('smartchoice:')));
  const change=detail.offers.find(row=>row.join_type==='기기변경');
  const manual=await saveRecord(db,'supports',{offer_id:change.id,amount:300000,source:'검증 수동 입력',expires_at:Date.now()+3600000});
  const allPlans=await db.all('SELECT id,enabled FROM plans');
  for(const row of allPlans)if(row.id!==change.plan_id)await db.run('UPDATE plans SET enabled=0 WHERE id=?',[row.id]);
  try {
    let requests=0;
    const result=await syncSupports(db,{},(...args)=>{requests++;return fetcher(...args);});
    assert.equal(result.status,'success');assert.equal(result.counts.updated,3);assert.equal(requests,1);
    detail=await product(db,phone.id);
    assert.equal(detail.offers.find(row=>row.id===change.id).support,300000);
    await db.run('UPDATE supports SET expires_at=? WHERE id=?',[Date.now()-1,manual.id]);
    assert.equal((await product(db,phone.id)).offers.find(row=>row.id===change.id).support,265000);
    const before=await db.all("SELECT * FROM supports WHERE mode='feed' AND offer_id=?",[change.id]);
    const failure=await syncSupports(db,{},()=>new Response(null,{status:503}));
    assert.equal(failure.status,'failed');assert.equal(failure.issues.length,3);
    assert.deepEqual(await db.all("SELECT * FROM supports WHERE mode='feed' AND offer_id=?",[change.id]),before);
    const history=await syncHistory(db);
    assert.ok(history.some(row=>row.status==='failed'&&row.issues.some(issue=>issue.product==='갤럭시 S25')));
    await saveRecord(db,'products',{...phone,sample:1,status:'published'},phone.id);
    const status=await supportSyncStatus(db,{});assert.equal(status.samples,3);assert.equal(status.total,0);
    let fetched=false;
    assert.equal((await syncSupports(db,{},()=>{fetched=true;})).status,'waiting');assert.equal(fetched,false);
    await assert.rejects(previewSupport(db,{...supportSelection,plan:'unknown'},fetcher),error=>error.code==='source_mismatch');
    await assert.rejects(previewSupport(db,supportSelection,supportFetcher({sellingPrice:1})),error=>error.code==='source_mismatch');
    await assert.rejects(previewSupport(db,supportSelection,()=>new Response(null,{status:503})),error=>error.code==='source_unavailable');
  } finally {
    await db.run('DELETE FROM products WHERE id=?',[phone.id]);
    for(const row of allPlans)await db.run('UPDATE plans SET enabled=? WHERE id=?',[row.enabled,row.id]);
  }
}
