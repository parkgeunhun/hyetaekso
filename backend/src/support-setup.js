import {officialEndpoint,officialRequest,parseOfficial,fetchOfficial,limitedText,carrierCode} from './carrier-support.js';
import {joins,offer,storageKey,supportSignature} from './catalog.js';
import {ApiError,choice,digest,invalid,money,text} from './security.js';
import {replace,saveRecord,settings} from './records.js';

const carrierNames={SKT:'SKT',KT:'KT',LGU:'LG U+'};
function selection(input) {
  const carrier=carrierCode(input.carrier);
  if(!carrier)throw invalid('SKT, KT, LG U+ 중 통신사를 선택해 주세요.');
  return {carrier,network:choice(input.network,['5G','LTE','3G'],'통신망'),maker:choice(input.maker,['삼성전자','애플','기타'],'제조사')};
}
const externalCode=value=>{
  if(typeof value!=='string'||!/^[A-Za-z0-9_+.-]{1,100}$/.test(value))throw invalid('공식 목록에서 휴대폰과 요금제를 다시 선택해 주세요.');
  return value;
};
async function publicList(config,path,params,fetcher) {
  const url=new URL(path,officialEndpoint('sc_price',config.sc_price));
  const response=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},body:new URLSearchParams(params),signal:AbortSignal.timeout(12000),redirect:'error'});
  return JSON.parse(await limitedText(response));
}
export async function supportCatalog(db,input,fetcher=fetch) {
  const {carrier,network,maker}=selection(input),config=await settings(db);
  const params={dan_Company:carrier,planSKTService:'',planKTService:'',planLGUService:'',dan_Mau:maker,searchType:'danTelSearch'};
  params['plan'+carrier+'Service']='PHONE_'+network;
  try {
    const [modelResult,planResult]=await Promise.all([
      publicList(config,'/smc/mobile/getTelProductList.do',params,fetcher),
      publicList(config,'/smc/mobile/getTelPlanList.do',params,fetcher)
    ]);
    const models=modelResult?.[0]?.listProductData,plans=planResult?.[0]?.listData;
    if(!Array.isArray(models)||!Array.isArray(plans)||models.length>2000||plans.length>2000)throw new Error('목록 형식 변경');
    const field={SKT:'skt_Pn',KT:'kt_Pn',LGU:'lg_Pn'}[carrier];
    return {
      models:models.filter(row=>row[field]&&row.dan_Service===network).map(row=>({id:externalCode(row[field]),name:text(row.dan_Pc_Name,'공식 단말명',160)})),
      plans:plans.map(row=>({id:externalCode(row.dan_Plan_Code),name:text(row.dan_Plan_Name,'공식 요금제명',160)}))
    };
  } catch(error) {
    if(error instanceof ApiError)throw error;
    throw new ApiError(502,'source_unavailable','공식 상품 목록을 불러오지 못했습니다. 잠시 후 다시 조회해 주세요.');
  }
}
export async function previewSupport(db,input,fetcher=fetch) {
  const {carrier,network,maker}=selection(input),model=externalCode(input.model),plan=externalCode(input.plan);
  const config=await settings(db),source_key=['smartchoice',model,network,maker].join(':');
  const base={source_key,plan_source:plan,carrier:carrierNames[carrier],join_type:'기기변경'};
  const target=officialRequest(base,config);
  let raw;
  try {raw=await fetchOfficial(target,fetcher);}catch {throw new ApiError(502,'source_unavailable','공식 지원금 조회에 연결하지 못했습니다. 기존 지원금은 유지됩니다.');}
  try {
    const info=JSON.parse(raw)?.[0]?.priceCompareInfo;
    if(!info)throw new Error('공개 자료에 이 휴대폰·요금제의 지원금이 없습니다. 다른 요금제를 선택하거나 수동 지원금을 입력해 주세요.');
    const storage=storageKey(String(info.used_Phone_Capacity??'').replace(/^(\d+)$/,'$1GB'));
    if(!/^\d+(?:\.\d+)?(?:GB|TB)$/.test(storage))throw new Error('공식 용량 정보를 확인할 수 없습니다.');
    const price=money(info.factoryPrice,'공식 출고가',1,100000000),fee=money(info.planMonthVat,'공식 월정액',0,100000000);
    const row={...base,storage,price,fee},checkedAt=Date.now();
    const supports=joins.map(join=>({join,...parseOfficial({...row,join_type:join},target,raw,checkedAt)}));
    const result={carrier:carrierNames[carrier],network,maker,model,plan,source_key,plan_source:plan,
      name:text(info.dan_Pc_Name,'공식 단말명',160),planName:text(info.dan_Plan_Name,'공식 요금제명',160),storage,price,fee,supports};
    return {...result,version:digest(JSON.stringify(result)),checkedAt};
  } catch(error) {throw new ApiError(422,'source_mismatch',error instanceof SyntaxError?'공식 지원금 응답 형식이 바뀌었습니다.':error.message);}
}
export async function importSupport(db,input,fetcher=fetch) {
  const requestKey=text(input.requestKey,'저장 요청 번호',36);
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requestKey))throw invalid('저장 요청 번호를 확인해 주세요.');
  const existingId=input.productId?text(input.productId,'휴대폰',64):null;
  const verified=await previewSupport(db,input,fetcher);
  if(verified.version!==input.version)throw new ApiError(409,'source_changed','공식 가격이 바뀌었습니다. 지원금을 다시 확인한 뒤 저장해 주세요.');
  return db.transaction(async()=>{
    const marker='support-import:'+requestKey;
    const [prior]=await db.all('SELECT value FROM settings WHERE id=?',[marker]);
    if(prior)return JSON.parse(prior.value);
    let product;
    if(existingId){
      await db.run('UPDATE products SET sort_order=sort_order WHERE id=?',[existingId]);
      [product]=await db.all('SELECT * FROM products WHERE id=?',[existingId]);
      if(!product||product.sample||product.closed||product.name.trim()!==verified.name.trim())throw invalid('전시·마감 상품이 아닌 같은 이름의 실제 휴대폰을 선택해 주세요.');
    } else {
      let [manufacturer]=await db.all('SELECT id FROM manufacturers WHERE name=?',[verified.maker]);
      manufacturer??=await saveRecord(db,'manufacturers',{name:verified.maker});
      product=await saveRecord(db,'products',{manufacturer_id:manufacturer.id,name:verified.name,status:'draft'},requestKey);
    }
    let [capacity]=await db.all('SELECT * FROM capacities WHERE product_id=? AND name=?',[product.id,verified.storage]);
    if(capacity&&Number(capacity.price)!==verified.price)throw invalid('등록된 출고가가 공식 출고가와 다릅니다. 용량·출고가에서 먼저 확인해 주세요.');
    capacity??=await saveRecord(db,'capacities',{product_id:product.id,name:verified.storage,price:verified.price});
    const carriers=await db.all('SELECT * FROM carriers');
    let carrier=carriers.find(row=>carrierCode(row.name)===carrierCode(verified.carrier));
    carrier??=await saveRecord(db,'carriers',{name:verified.carrier});
    let [plan]=await db.all('SELECT * FROM plans WHERE carrier_id=? AND name=? AND fee=?',[carrier.id,verified.planName,verified.fee]);
    if(plan&&(plan.source_key!==verified.plan_source||!plan.enabled))throw invalid('같은 요금제가 다른 조회 코드로 등록되어 있거나 비활성화 상태입니다. 요금제 관리에서 확인해 주세요.');
    plan??=await saveRecord(db,'plans',{carrier_id:carrier.id,name:verified.planName,fee:verified.fee,enabled:1,source_key:verified.plan_source});
    const ids=[];
    for(const support of verified.supports){
      let [record]=await db.all('SELECT * FROM offers WHERE capacity_id=? AND plan_id=? AND join_type=?',[capacity.id,plan.id,support.join]);
      if(record&&record.source_key!==verified.source_key)throw invalid('같은 가격 조건에 다른 조회 연결이 있습니다. 가격 조건에서 확인해 주세요.');
      record??=await saveRecord(db,'offers',{capacity_id:capacity.id,plan_id:plan.id,join_type:support.join,source_key:verified.source_key,extra:0});
      const current=await offer(db,record.id);
      await replace(db,'supports',record.id+'-feed',{offer_id:record.id,mode:'feed',amount:support.amount,source:support.source,
        updated_at:verified.checkedAt,expires_at:verified.checkedAt+36*3600000,signature:supportSignature(current)});
      ids.push(record.id);
    }
    const result={id:product.id,name:product.name,status:product.status,offers:ids,updated:ids.length};
    await replace(db,'settings',marker,{value:JSON.stringify(result)});
    return result;
  });
}
