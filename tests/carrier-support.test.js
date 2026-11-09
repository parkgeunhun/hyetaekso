import {test} from 'node:test';
import assert from 'node:assert/strict';
import {officialEndpoint,officialRequest,parseOfficial,limitedText} from '../backend/src/carrier-support.js';
import {product} from '../backend/src/catalog.js';
import {saveRecord} from '../backend/src/records.js';
import {syncSupports} from '../backend/src/sync.js';
import {sqlite} from '../scripts/local-db.mjs';
const today=Date.parse('2026-11-09T00:00:00Z');
test('SKT applies only exact common subsidy and rejects a fallback plan or ambiguous model',()=>{
  const row={source_key:'skt:A543:5G',plan_source:'NA00009800',carrier:'SKT',join_type:'기기변경',fee:69000,price:1243000,storage:'128GB'};
  const request=officialRequest(row);
  assert.equal(new URL(request.url).searchParams.get('scrbTypCd'),'31');
  const item={modelCd:'A543',productMem:'128G',prodId:row.plan_source,scrbTypCd:'31',dcMthdCd:'10',factoryPrice:row.price,sumSaleAmt:650000,telecomSaleAmt:600000,dsnetSupmAmt:550000,effStaDt:'20200101'};
  const html=(products,fee=row.fee)=>'_this.products = parseObject('+JSON.stringify(products)+'); _this.selectedFee = parseObject('+JSON.stringify({prodId:row.plan_source,basicCharge:fee})+');';
  assert.equal(parseOfficial(row,request,html([item]),today).amount,650000);
  for(const invalid of [html([item],1),html([item,item]),html([{...item,productMem:'256G'}]),html([{...item,effStaDt:'20260230'}])])assert.throws(()=>parseOfficial(row,request,invalid,today));
});
test('SmartChoice adds transfer support only for number transfer and checks both final prices',()=>{
  const row={source_key:'smartchoice:SM-123:5G:삼성전자',plan_source:'PLAN',carrier:'KT',join_type:'번호이동',fee:39000,price:1155000,storage:'256GB'};
  const request=officialRequest(row);
  const item={dan_Company:'KT',productName:'SM-123',dan_Service:'5G',dan_Plan_Code:'PLAN',used_Phone_Capacity:'256',planMonthVat:39000,factoryPrice:1155000,dan_SupportMoney:'230000',conv_SupportMoney:'90000',sellingPrice:925000,dan_Conv_SellingPrice:835000,updateDate:'20260101',conv_UpdateDate:'20261109'};
  const body=info=>JSON.stringify([{priceCompareInfo:info}]);
  assert.equal(parseOfficial(row,request,body(item),today).amount,320000);
  assert.equal(parseOfficial({...row,join_type:'신규가입'},request,body(item),today).amount,230000);
  assert.throws(()=>parseOfficial(row,request,body({...item,dan_Conv_SellingPrice:1}),today));
  assert.throws(()=>officialEndpoint('sc_price','https://another.example/anything'));
});
test('rejects oversized or unsuccessful upstream responses',async()=>{
  assert.equal(await limitedText(new Response('hello'),5),'hello');
  await assert.rejects(limitedText(new Response('hello'),4));
  await assert.rejects(limitedText(new Response(null,{status:503})));
});

test('a failed custom feed does not block official support updates',async()=>{
  const db=await sqlite(':memory:');
  try {
    const manufacturer=await saveRecord(db,'manufacturers',{name:'애플'});
    const phone=await saveRecord(db,'products',{manufacturer_id:manufacturer.id,name:'iPhone 15',status:'published'});
    const cap=await saveRecord(db,'capacities',{product_id:phone.id,name:'128GB',price:1243000});
    const carrier=await saveRecord(db,'carriers',{name:'SKT'});
    const plan=await saveRecord(db,'plans',{carrier_id:carrier.id,name:'검증 요금제',fee:69000,enabled:1,source_key:'NA00009800'});
    const official=await saveRecord(db,'offers',{capacity_id:cap.id,plan_id:plan.id,join_type:'기기변경',source_key:'skt:A543:5G'});
    const custom=await saveRecord(db,'offers',{capacity_id:cap.id,plan_id:plan.id,join_type:'번호이동',source_key:'custom-model'});
    const item={modelCd:'A543',productMem:'128G',prodId:'NA00009800',scrbTypCd:'31',dcMthdCd:'10',factoryPrice:1243000,sumSaleAmt:650000,effStaDt:'20200101'};
    const html='_this.products = parseObject('+JSON.stringify([item])+'); _this.selectedFee = parseObject({"prodId":"NA00009800","basicCharge":69000});';
    const feed='https://feed.example.test/support.json';
    const report=await syncSupports(db,{SUPPORT_FEED_URL:feed},url=>String(url)===feed?new Response(null,{status:503}):new Response(html));
    assert.equal(report.status,'partial');
    const {offers}=await product(db,phone.id);
    assert.equal(offers.find(row=>row.id===official.id)?.support,650000);
    assert.equal(offers.find(row=>row.id===custom.id)?.support_known,false);
  } finally {db.close();}
});
