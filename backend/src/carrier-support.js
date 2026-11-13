import { storageKey } from './catalog.js';

export const officialEndpoints={
  skt_notice:'https://shop.tworld.co.kr/notice',
  sc_price:'https://m.smartchoice.or.kr/smc/mobile/getPriceCompare.do'
};
export function officialEndpoint(key,value) {
  const original=new URL(officialEndpoints[key]);
  const url=new URL(value||original.href);
  if (url.origin!==original.origin||url.username||url.password||url.search||url.hash||!/^\/[a-zA-Z0-9_./-]+$/.test(url.pathname)) throw new Error('지원금 공개 조회 주소를 확인해 주세요.');
  return url;
}
const codes={'신규가입':'11','번호이동':'20','기기변경':'31'};
const carriers={SKT:'SKT',KT:'KT','LGU+':'LGU'};
export const carrierCode=name=>carriers[String(name).replace(/\s+/g,'').toUpperCase()];
const identifier=/^[A-Za-z0-9_+.-]{1,100}$/;
const integer=(value,max=100000000)=>{
  if(!['string','number'].includes(typeof value)||!/^\d{1,9}$/.test(String(value))||+value>max)throw new Error('금액 형식 불일치');
  return +value;
};
const capacity=value=>['string','number'].includes(typeof value)?storageKey(String(value).replace(/^(\d+(?:\.\d+)?)\s*([GT])$/i,'$1$2B').replace(/^(\d+)$/,'$1GB')):'';
function date(value,now) {
  if(typeof value!=='string'||!/^\d{8}$/.test(value))throw new Error('기준일 누락');
  const iso=value.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
  const parsed=new Date(iso);
  if(!Number.isFinite(+parsed)||parsed.toISOString().slice(0,10)!==iso||iso>new Date(now+32400000).toISOString().slice(0,10))throw new Error('유효하지 않은 기준일');
  return iso;
}
export function officialRequest(row,config={}) {
  const parts=row.source_key.split(':');
  const [source,model,network,maker]=parts;
  const plan=row.plan_source;
  if(!identifier.test(model??'')||!identifier.test(plan??'')||!codes[row.join_type])throw new Error('단말·요금제 연결 코드 누락');
  if(source==='skt'&&parts.length===3&&carrierCode(row.carrier)==='SKT'&&['5G','PHONE'].includes(network)) {
    const url=officialEndpoint('skt_notice',config.skt_notice);
    url.search=new URLSearchParams({modelNwType:network,saleMonth:'24',prodId:plan,saleYn:'N',order:'DISCOUNT',scrbTypCd:codes[row.join_type],dcMthdCd:'10'});
    return {source,model,plan,network,url:String(url)};
  }
  const carrier=carrierCode(row.carrier);
  if(source==='smartchoice'&&parts.length===4&&carrier&&['5G','LTE','3G'].includes(network)&&['삼성전자','애플','기타'].includes(maker)) {
    return {source,model,plan,network,carrier,url:String(officialEndpoint('sc_price',config.sc_price)),body:new URLSearchParams({dan_Company:carrier,dan_Service:network,dan_Mau:maker,productName:model,dan_Plan_Code:plan}).toString()};
  }
  throw new Error('지원금 매핑 형식 불일치');
}
export function parseOfficial(row,target,raw,now) {
  if(target.source==='skt') {
    const products=JSON.parse(raw.match(/_this\.products\s*=\s*parseObject\s*\((\[.*?\])\s*\)\s*;/s)?.[1]??'null');
    const plan=JSON.parse(raw.match(/_this\.selectedFee\s*=\s*parseObject\s*\((\{.*?\})\s*\)\s*;/s)?.[1]??'null');
    if(!Array.isArray(products)||products.length>10000||plan?.prodId!==target.plan||plan.basicCharge!==row.fee)throw new Error('SKT 요금제 불일치');
    const matches=products.filter(item=>item?.modelCd===target.model&&item.prodId===target.plan&&String(item.scrbTypCd)===codes[row.join_type]&&String(item.dcMthdCd)==='10'&&capacity(item.productMem)===row.storage);
    if(matches.length!==1)throw new Error('SKT 단말 조건을 확인할 수 없음');
    const item=matches[0],effective=date(item.effStaDt,now);
    if(!Number.isSafeInteger(item.sumSaleAmt)||!Number.isSafeInteger(item.factoryPrice)||item.factoryPrice!==row.price)throw new Error('SKT 출고가 불일치');
    return {amount:integer(item.sumSaleAmt,row.price),source:'SKT T다이렉트샵 (24개월, 기준 '+effective+')'};
  }
  const result=JSON.parse(raw);
  const info=result?.[0]?.priceCompareInfo;
  if(!info)throw new Error('공개 자료에 해당 단말·요금제의 지원금이 없습니다. 다른 요금제를 선택하거나 수동 지원금을 입력해 주세요.');
  if(info?.dan_Company!==target.carrier||info?.productName!==target.model||info?.dan_Service!==target.network||info?.dan_Plan_Code!==target.plan||capacity(info?.used_Phone_Capacity)!==row.storage)throw new Error('스마트초이스 단말 조건 불일치');
  if(integer(info.planMonthVat)!==row.fee||integer(info.factoryPrice)!==row.price)throw new Error('스마트초이스 요금·출고가 불일치');
  const base=integer(info.dan_SupportMoney,row.price),transfer=integer(info.conv_SupportMoney,row.price-base);
  if(integer(info.sellingPrice)!==row.price-base||integer(info.dan_Conv_SellingPrice)!==row.price-base-transfer)throw new Error('스마트초이스 구매가 불일치');
  const port=row.join_type==='번호이동';
  const baseDate=date(info.updateDate,now);
  const effective=port&&transfer?[baseDate,date(info.conv_UpdateDate,now)].sort().at(-1):baseDate;
  return {amount:base+(port?transfer:0),source:'스마트초이스 ('+row.carrier+', 기준 '+effective+')'};
}
export async function limitedText(response,limit=2000000) {
  if(!response.ok||!response.body||Number(response.headers.get('Content-Length'))>limit)throw new Error('공개 지원금 요청 실패');
  const reader=response.body.getReader(),decode=new TextDecoder();
  let bytes=0,out='';
  try {
    for(;;) {
      const {value,done}=await reader.read();
      if(done)break;
      bytes+=value.byteLength;
      if(bytes>limit)throw new Error('지원금 응답 크기 초과');
      out+=decode.decode(value,{stream:true});
    }
    return out+decode.decode();
  } finally {await reader.cancel().catch(()=>{});}
}
export async function fetchOfficial(target,fetcher=fetch) {
  const options={signal:AbortSignal.timeout(12000),redirect:'error'};
  if(target.body)Object.assign(options,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},body:target.body});
  return limitedText(await fetcher(target.url,options));
}
