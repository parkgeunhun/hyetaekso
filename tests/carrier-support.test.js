import {test} from 'node:test';
import assert from 'node:assert/strict';
import {officialEndpoint,officialRequest,parseOfficial,limitedText} from '../backend/src/carrier-support.js';
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
