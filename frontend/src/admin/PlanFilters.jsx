import {useLayoutEffect,useRef,useState} from 'react';
import {useNavigationType,useSearchParams} from 'react-router-dom';

const defaults={q:'',carrier:'',minFee:'',maxFee:'',enabled:'',sort:'carrier'};
const sorts=['carrier','name','fee-asc','fee-desc'];
const amount=value=>/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))?value:'';

export function readPlanFilters(params) {
  return {
    q:params.get('q')??'',carrier:params.get('carrier')??'',
    minFee:amount(params.get('minFee')??''),maxFee:amount(params.get('maxFee')??''),
    enabled:['0','1'].includes(params.get('enabled'))?params.get('enabled'):'',
    sort:sorts.includes(params.get('sort'))?params.get('sort'):'carrier'
  };
}
export function invalidPlanRange(filters) {
  return filters.minFee!==''&&filters.maxFee!==''&&Number(filters.minFee)>Number(filters.maxFee);
}
export function usePlanFilters() {
  const [params,setParams]=useSearchParams(),navigationType=useNavigationType();
  const [filters,setFilters]=useState(()=>readPlanFilters(params));
  const latestParams=useRef(params),pendingSearch=useRef(null);
  useLayoutEffect(()=>{
    const search=params.toString();
    if(pendingSearch.current===search){pendingSearch.current=null;return;}
    if(pendingSearch.current!==null&&navigationType==='REPLACE')return;
    pendingSearch.current=null;
    latestParams.current=params;
    setFilters(readPlanFilters(params));
  },[params,navigationType]);
  function update(patch) {
    const next=new URLSearchParams(latestParams.current);
    for(const [key,value] of Object.entries(patch)) {
      if(value===defaults[key])next.delete(key);else next.set(key,value);
    }
    latestParams.current=next;
    pendingSearch.current=next.toString();
    // Keep controlled inputs synchronous; router transitions only persist the URL.
    setFilters(readPlanFilters(next));
    setParams(next,{replace:true});
  }
  return [filters,update];
}
export function filterPlans(rows,filters) {
  if(invalidPlanRange(filters))return [];
  const words=filters.q.trim().toLocaleLowerCase('ko-KR').split(/\s+/).filter(Boolean);
  return rows.filter(row=>{
    const text=[row.carrier,row.name].join(' ').toLocaleLowerCase('ko-KR');
    return words.every(word=>text.includes(word))&&
      (!filters.carrier||row.carrier_id===filters.carrier)&&
      (filters.enabled===''||Number(row.enabled)===Number(filters.enabled))&&
      (filters.minFee===''||Number(row.fee)>=Number(filters.minFee))&&
      (filters.maxFee===''||Number(row.fee)<=Number(filters.maxFee));
  }).sort((a,b)=>{
    const byName=String(a.name).localeCompare(String(b.name),'ko');
    const byCarrier=String(a.carrier).localeCompare(String(b.carrier),'ko');
    const byFee=Number(a.fee)-Number(b.fee);
    const primary=filters.sort==='fee-asc'?byFee:filters.sort==='fee-desc'?-byFee:filters.sort==='name'?byName:byCarrier;
    return primary||byName||byCarrier||String(a.id).localeCompare(String(b.id));
  });
}

export default function PlanFilters({filters,update,carriers=[],rows,count,loaded}) {
  const active=Object.entries(defaults).some(([key,value])=>filters[key]!==value);
  const options=new Map(carriers.map(row=>[row.id,row.name]));
  for(const row of rows)if(row.carrier_id&&!options.has(row.carrier_id))options.set(row.carrier_id,row.carrier||'통신사 확인 필요');
  const invalid=invalidPlanRange(filters);
  return <section className="plan-filters" aria-label="요금제 필터">
    <div className="plan-filter-grid">
      <label className="plan-filter-search">요금제·통신사 검색<input type="search" placeholder="예: SKT 컴팩트" value={filters.q} onChange={e=>update({q:e.target.value})}/></label>
      <label>통신사<select value={filters.carrier} onChange={e=>update({carrier:e.target.value})}>
        <option value="">전체 통신사</option>{[...options].sort((a,b)=>a[1].localeCompare(b[1],'ko')).map(([id,name])=><option key={id} value={id}>{name}</option>)}
      </select></label>
      <label>사용 상태<select value={filters.enabled} onChange={e=>update({enabled:e.target.value})}><option value="">전체 상태</option><option value="1">사용 중</option><option value="0">사용 안 함</option></select></label>
      <fieldset className="plan-fee-range"><legend>월정액 범위</legend><div>
        <label>최소 월정액 (원)<input type="number" min="0" step="1" inputMode="numeric" placeholder="제한 없음" value={filters.minFee} aria-invalid={invalid||undefined} aria-describedby={invalid?'plan-fee-error':undefined} onChange={e=>update({minFee:e.target.value})}/></label>
        <span aria-hidden="true">~</span>
        <label>최대 월정액 (원)<input type="number" min="0" step="1" inputMode="numeric" placeholder="제한 없음" value={filters.maxFee} aria-invalid={invalid||undefined} aria-describedby={invalid?'plan-fee-error':undefined} onChange={e=>update({maxFee:e.target.value})}/></label>
      </div></fieldset>
      <label>정렬<select value={filters.sort} onChange={e=>update({sort:e.target.value})}><option value="carrier">통신사·이름순</option><option value="fee-asc">월정액 낮은순</option><option value="fee-desc">월정액 높은순</option><option value="name">요금제 이름순</option></select></label>
    </div>
    {invalid&&<p id="plan-fee-error" className="message error" role="alert">최대 월정액을 최소 월정액 이상으로 입력해 주세요.</p>}
    <div className="plan-filter-summary"><span role="status">{loaded?`전체 ${rows.length}개 중 ${count}개 표시`:'요금제를 불러오는 중입니다.'}</span><button type="button" className="btn" disabled={!active} onClick={()=>update(defaults)}>필터 초기화</button></div>
    <small className="plan-table-hint">표를 좌우로 밀면 수정·삭제 버튼까지 볼 수 있습니다.</small>
  </section>;
}
