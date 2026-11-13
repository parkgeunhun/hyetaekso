import { useEffect,useMemo,useState } from 'react';
import { Link,useParams,useSearchParams } from 'react-router-dom';
import { useResource } from '../hooks/data.js';
import { useSite } from '../layouts/SiteLayout.jsx';
import { Breadcrumb,Section,Status } from '../components/common.jsx';
import { estimate } from '../../../shared/quote.js';
import { ConsultationLink,useConsultation } from '../components/ConsultationLink.jsx';
import { discountOptions,phoneInquiry } from '../../../shared/consultation.js';

const won=value=>Number(value).toLocaleString('ko-KR')+'원';
export function Catalog() {
  const resource=useResource('/products'),[params,setParams]=useSearchParams();
  const filter={name:params.get('name')||'',manufacturer:params.get('manufacturer')||'',category:params.get('category')||'',sort:params.get('sort')||'display'};
  const update=(key,value)=>setParams(previous=>{
    const next=new URLSearchParams(previous);
    if(value&&(key!=='sort'||value!=='display'))next.set(key,value);else next.delete(key);
    return next;
  },{replace:true,preventScrollReset:true});
  const filtered=Boolean(filter.name||filter.manufacturer||filter.category||filter.sort!=='display');
  function resetFilters() {
    setParams(previous=>{
      const next=new URLSearchParams(previous);
      for(const key of Object.keys(filter))next.delete(key);
      return next;
    },{replace:true,preventScrollReset:true});
  }
  const manufacturers=[...new Map(resource.data?.items.map(row=>[row.manufacturer_id,row.manufacturer])||[])];
  let rows=resource.data?.items.filter(row=>(!filter.manufacturer||row.manufacturer_id===filter.manufacturer)&&row.name.toLowerCase().includes(filter.name.trim().toLowerCase())&&
    (!filter.category||resource.data.links.some(link=>link.product_id===row.id&&link.category_id===filter.category)))||[];
  if(filter.sort==='price')rows.sort((a,b)=>(a.price??Infinity)-(b.price??Infinity));
  if(filter.sort==='name')rows.sort((a,b)=>a.name.localeCompare(b.name,'ko'));
  return <><Breadcrumb title="휴대폰"/><Section title="휴대폰 전체 모델" description="기종부터 통신사별 요금과 지원금까지 확인하세요.">
    <div className="filters"><label>모델 검색<input type="search" value={filter.name} onChange={e=>update('name',e.target.value)} placeholder="모델명 입력"/></label>
      <label>제조사<select value={filter.manufacturer} onChange={e=>update('manufacturer',e.target.value)}><option value="">전체</option>{manufacturers.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
      <label>카테고리<select value={filter.category} onChange={e=>update('category',e.target.value)}><option value="">전체</option>{resource.data?.categories.map(row=><option value={row.id} key={row.id}>{row.name}</option>)}</select></label>
      <label>정렬<select value={filter.sort} onChange={e=>update('sort',e.target.value)}><option value="display">기본 순서</option><option value="price">출고가 낮은 순</option><option value="name">모델명 순</option></select></label></div>
    <Status resource={resource}/>{resource.data&&<div className="results-toolbar"><p role="status">전체 {resource.data.items.length}개 중 <strong>{rows.length}개</strong> 모델</p><button type="button" className="btn" disabled={!filtered} onClick={resetFilters}>검색 조건 초기화</button></div>}
    <div className="card-grid columns-4">{rows.map(item=><Link key={item.id} className="service-card catalog-card" to={'/phones/'+item.id}><small>{item.sample?'전시 예시':item.closed?'상담 마감':item.manufacturer}</small>{item.image&&<img src={item.image} alt="" loading="lazy"/>}<h3>{item.name}</h3><p>{item.price!=null?won(item.price)+'부터':'가격 조건 준비 중'}</p><span>조건 선택하기 ›</span></Link>)}</div>
    {resource.data&&!rows.length&&<p className="message">조건에 맞는 모델이 없습니다.</p>}</Section></>;
}
const selectors=[['carrier','구매할 통신사'],['join_type','가입 유형'],['storage','용량'],['plan_id','요금제']];
const preferredOptions={carrier:['SKT','KT','LG U+','LGU+'],join_type:['기기변경','신규가입','번호이동']};
const installmentOptions=[24,30,36].map(value=>[value,value+'개월']);
function optionOrder(key,value) {
  const order=preferredOptions[key];
  const index=order.indexOf(value);
  return index<0?order.length:index;
}
function PurchaseOptions({label,options,selected,onSelect,hints,children}) {
  const columns=Math.max(2,Math.min(options.length,3));
  return <fieldset className="purchase-group">
    <legend>{label}</legend>
    <div className="purchase-buttons" style={{'--option-columns':columns}}>
      {options.map(([value,name])=><button key={value} type="button" title={hints?.[name]} aria-pressed={selected===value}
        onClick={()=>onSelect(value)}>{name}</button>)}
    </div>
    {children}
  </fieldset>;
}
function Calculator({item,retry}) {
  const {settings}=useSite(),[selection,setSelection]=useState({}),[color,setColor]=useState(item.colors[0]?.name||''),[mode,setMode]=useState('support'),[months,setMonths]=useState(24);
  const hasOffers=item.offers.length>0;
  const options=(level,values)=>item.offers.filter(row=>selectors.slice(0,level).every(([key])=>!values[key]||values[key]===row[key]));
  function select(level,value) {
    setSelection(prior=>{
      const next={...prior,[selectors[level][0]]:value};
      for(let i=level+1;i<selectors.length;i++) {
        const key=selectors[i][0];
        if(next[key]&&!options(i,next).some(row=>row[key]===next[key]))delete next[key];
      }
      return next;
    });
  }
  const row=selectors.every(([key])=>selection[key])?options(selectors.length,selection)[0]:null;
  const canConsult=!item.sample&&!item.closed&&Boolean(row||settings.help_enabled===1);
  const setPhone=useConsultation()?.setPhone;
  const phoneRequest=useMemo(()=>({
    detail:phoneInquiry({model:item.name,color,carrier:selection.carrier,join:selection.join_type,storage:selection.storage,
      plan:item.offers.find(offer=>offer.plan_id===selection.plan_id)?.plan,mode:hasOffers?mode:null,months:hasOffers?months:null}),
    quoteInput:{productId:item.id,color,selection,offerId:row?.id,version:row?.version,mode,months},
    onQuoteChanged:retry
  }),[item,color,selection,hasOffers,row,mode,months,retry]);
  useEffect(()=>{
    if(!setPhone||!canConsult)return;
    setPhone(phoneRequest);
    return ()=>setPhone(null);
  },[setPhone,canConsult,phoneRequest]);
  const result=row?estimate(row,mode,months):null;
  const picture=item.colors.find(entry=>entry.name===color)?.image||item.image;
  const joins={기기변경:settings.join_change,신규가입:settings.join_new,번호이동:settings.join_port};
  return <div className="phone-detail"><div className="phone-media">{picture&&<img src={picture} alt={item.name+(color?' '+color:'')}/>}<p className="preserve">{item.description}</p></div>
    <div><section className="form-panel purchase-panel" aria-labelledby="purchase-heading"><h2 id="purchase-heading">구매 조건 선택</h2>
      {item.colors.length>0&&<PurchaseOptions label="색상" options={item.colors.map(({name})=>[name,name])} selected={color} onSelect={setColor}/>}
      {hasOffers&&selectors.map(([key,label],level)=>{
        const available=[...new Map(options(level,selection).map(option=>[option[key],key==='plan_id'?option.plan+' · '+won(option.fee):option[key]]))];
        if(preferredOptions[key])available.sort(([left],[right])=>optionOrder(key,left)-optionOrder(key,right));
        if(key==='plan_id')return <label key={key}>{label}<select aria-label={label} value={selection[key]??''} onChange={e=>select(level,e.target.value)}><option value="">요금제 선택</option>{available.map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>;
        const isJoin=key==='join_type';
        return <PurchaseOptions key={key} label={label} options={available} selected={selection[key]} onSelect={value=>select(level,value)} hints={isJoin?joins:undefined}>
          {isJoin&&<details className="join-help"><summary>가입 유형 설명</summary>{Object.entries(joins).map(([name,help])=><p key={name}><strong>{name}</strong> {help}</p>)}</details>}
        </PurchaseOptions>;
      })}
      {hasOffers&&<div className="purchase-payment">
        <PurchaseOptions label="할인 방식" options={discountOptions} selected={mode} onSelect={setMode}/>
        <PurchaseOptions label="할부 개월" options={installmentOptions} selected={months} onSelect={setMonths}/>
      </div>}
      {result?<div className="quote-box" aria-live="polite"><div><span>출고가</span><b>{won(row.price)}</b></div><div><span>공통지원금</span><b>{result.pending?'확인 중':won(result.support)}</b></div><div><span>추가 지원금</span><b>{won(row.extra)}</b></div><div><span>선택약정 월 할인</span><b>{won(result.discount)}</b></div><div><span>단말기 원금</span><b>{won(result.principal)}</b></div><div className="quote-total"><span>월 예상 납부액</span><strong>{won(result.monthly)}</strong></div><small>할부 이자 제외. {result.pending&&'공통지원금 차감 전 금액입니다.'}</small></div>:<p className="message">{hasOffers?'통신사, 가입 유형, 용량, 요금제를 선택해 주세요.':'이 모델의 통신사와 요금제 조건을 준비 중입니다.'}</p>}
    </section>
    {item.sample||item.closed?<p className="message">{item.sample?'전시 예시 상품입니다. 계산 결과를 확인할 수 있습니다.':'이 상품은 상담 접수가 마감되었습니다.'}</p>:
      canConsult&&<ConsultationLink className="btn primary phone-consultation-button" service="휴대폰" fromPhone>선택한 조건으로 상담 신청</ConsultationLink>}
    </div></div>;
}
export function PhoneDetail() {
  const {id}=useParams(),resource=useResource('/products/'+encodeURIComponent(id),{keepData:true});
  return <><Breadcrumb title="휴대폰 상세"/><Section title={resource.data?.name||'휴대폰 상세'}><Status resource={resource}/>{resource.data&&<Calculator item={resource.data} retry={resource.retry}/>}</Section></>;
}
