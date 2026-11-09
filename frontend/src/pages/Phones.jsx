import { useState } from 'react';
import { Link,useParams } from 'react-router-dom';
import { useResource } from '../hooks/data.js';
import { useSite } from '../layouts/SiteLayout.jsx';
import { Breadcrumb,Section,Status } from '../components/common.jsx';
import { estimate } from '../../../shared/quote.js';
import { ConsultationForm } from './Consultation.jsx';

const won=value=>Number(value).toLocaleString('ko-KR')+'원';
export function Catalog() {
  const resource=useResource('/products'),[filter,setFilter]=useState({name:'',manufacturer:'',category:'',sort:'display'});
  const update=(key,value)=>setFilter(previous=>({...previous,[key]:value}));
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
    <Status resource={resource}/><div className="card-grid columns-4">{rows.map(item=><Link key={item.id} className="service-card catalog-card" to={'/phones/'+item.id}><small>{item.sample?'전시 예시':item.closed?'상담 마감':item.manufacturer}</small>{item.image&&<img src={item.image} alt="" loading="lazy"/>}<h3>{item.name}</h3><p>{item.price?won(item.price)+'부터':'가격 조건 준비 중'}</p><span>조건 선택하기 ›</span></Link>)}</div>
    {resource.data&&!rows.length&&<p className="message">조건에 맞는 모델이 없습니다.</p>}</Section></>;
}
const selectors=[['carrier','구매할 통신사'],['join_type','가입 유형'],['storage','용량'],['plan_id','요금제']];
function Calculator({item,retry}) {
  const {settings}=useSite(),[selection,setSelection]=useState({}),[color,setColor]=useState(item.colors[0]?.name||''),[mode,setMode]=useState('support'),[months,setMonths]=useState(24);
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
  const result=row?estimate(row,mode,months):null;
  const picture=item.colors.find(entry=>entry.name===color)?.image||item.image;
  const joins={기기변경:settings.join_change,신규가입:settings.join_new,번호이동:settings.join_port};
  return <div className="phone-detail"><div className="phone-media">{picture&&<img src={picture} alt={item.name+(color?' '+color:'')}/>}<p className="preserve">{item.description}</p></div>
    <div><div className="form-panel"><h2>구매 조건 선택</h2>
      {item.colors.length>0&&<fieldset><legend>색상</legend><div className="choices">{item.colors.map(entry=><button key={entry.name} aria-pressed={color===entry.name} onClick={()=>setColor(entry.name)}>{entry.name}</button>)}</div></fieldset>}
      {selectors.map(([key,label],level)=>{
        const available=[...new Map(options(level,selection).map(option=>[option[key],key==='plan_id'?option.plan+' · '+won(option.fee):option[key]]))];
        if(key==='plan_id')return <label key={key}>{label}<select aria-label={label} value={selection[key]??''} onChange={e=>select(level,e.target.value)}><option value="">요금제 선택</option>{available.map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>;
        return <fieldset key={key}><legend>{label}</legend><div className="choices">{available.map(([value,name])=><button key={value} title={key==='join_type'?joins[name]:undefined} aria-pressed={selection[key]===value} onClick={()=>select(level,value)}>{name}</button>)}</div>{key==='join_type'&&<details className="join-help"><summary>가입 유형 설명</summary>{Object.entries(joins).map(([name,help])=><p key={name}><strong>{name}</strong> {help}</p>)}</details>}</fieldset>;
      })}
      <div className="filters"><label>할인 방식<select value={mode} onChange={e=>setMode(e.target.value)}><option value="support">공통지원금</option><option value="contract">선택약정 25%</option></select></label><label>할부 개월<select value={months} onChange={e=>setMonths(Number(e.target.value))}>{[24,30,36].map(value=><option key={value}>{value}</option>)}</select></label></div>
      {result?<div className="quote-box" aria-live="polite"><div><span>출고가</span><b>{won(row.price)}</b></div><div><span>공통지원금</span><b>{result.pending?'확인 중':won(result.support)}</b></div><div><span>추가 지원금</span><b>{won(row.extra)}</b></div><div><span>선택약정 월 할인</span><b>{won(result.discount)}</b></div><div><span>단말기 원금</span><b>{won(result.principal)}</b></div><div className="quote-total"><span>월 예상 납부액</span><strong>{won(result.monthly)}</strong></div><small>할부 이자 제외. {result.pending&&'공통지원금 차감 전 금액입니다.'}</small></div>:<p className="message">통신사, 가입 유형, 용량, 요금제를 선택해 주세요.</p>}
    </div>
    {item.sample||item.closed?<p className="message">{item.sample?'전시 예시 상품입니다. 계산 결과를 확인할 수 있습니다.':'이 상품은 상담 접수가 마감되었습니다.'}</p>:
      (row||settings.help_enabled===1)&&<ConsultationForm fixedService="휴대폰" quoteInput={{productId:item.id,color,selection,offerId:row?.id,version:row?.version,mode,months}} onQuoteChanged={retry}/>}
    </div></div>;
}
export function PhoneDetail() {
  const {id}=useParams(),resource=useResource('/products/'+encodeURIComponent(id));
  return <><Breadcrumb title="휴대폰 상세"/><Section title={resource.data?.name||'휴대폰 상세'}><Status resource={resource}/>{resource.data&&<Calculator item={resource.data} retry={resource.retry}/>}</Section></>;
}
