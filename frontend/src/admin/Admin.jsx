import { useEffect,useState } from 'react';
import { Link,NavLink,useParams,useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { useResource } from '../hooks/data.js';
import { Logo } from '../layouts/SiteLayout.jsx';
import { Icon,Status,Modal } from '../components/common.jsx';
import { entities,leadStates } from './fields.js';
import { Records,SiteSettings,Excel } from './Editors.jsx';
import AppearanceEditor from './AppearanceEditor.jsx';
import PhoneRegistration from './PhoneRegistration.jsx';
import './admin.css';

const groups=[['상품 관리',['phone-registration','products','manufacturers','categories','capacities','colors']],['가격과 지원금',['carriers','plans','offers','supports','sync','excel']],['화면 관리',['appearance','banners','content','settings']],['상담 관리',['leads']]];
const titles={sync:'지원금 갱신',excel:'엑셀 일괄 작업',leads:'상담 접수',settings:'사이트 설정',appearance:'사이트 이미지·배너 편집','phone-registration':'휴대폰 등록'};
const time=value=>value?new Date(Number(value)).toLocaleString('ko-KR'):'기록 없음';
function Login({onLogin,logo}) {
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(event) {
    event.preventDefault();setBusy(true);setError('');
    try {onLogin(await api('/admin/login',{method:'POST',body:Object.fromEntries(new FormData(event.currentTarget))}));}
    catch(error){setError(error.message);}finally{setBusy(false);}
  }
  return <main className="login-page"><form className="form-panel" onSubmit={submit}><Logo image={logo}/><h1>관리자 로그인</h1><p>혜택소 운영 계정으로 로그인하세요.</p><label>아이디<input name="username" autoComplete="username" required/></label><label>비밀번호<input name="password" type="password" autoComplete="current-password" required/></label>{error&&<p role="alert" className="message error">{error}</p>}<button className="btn primary" disabled={busy}>{busy?'로그인 중…':'로그인'}</button></form></main>;
}
function Dashboard() {
  const resource=useResource('/admin/dashboard'),data=resource.data;
  const count=status=>data?.leads.find(row=>row.status===status)?.count??0;
  return <><div className="admin-head"><div><h1>대시보드</h1><p>상담 접수, 공개 상품과 지원금 상태를 확인하세요.</p></div><div className="actions"><Link className="btn primary" to="/admin/phone-registration">휴대폰 등록</Link><Link className="btn" to="/admin/appearance">이미지·배너 편집</Link></div></div><Status resource={resource}/>
    {data&&<><div className="admin-metrics">{[['새 상담',count('접수완료'),'/admin/leads?status=접수완료','ClipboardList'],['상담 중',count('상담중'),'/admin/leads?status=상담중','Headset'],['상담 완료',count('상담완료'),'/admin/leads?status=상담완료','Check'],['공개 휴대폰',data.products,'/admin/products','Smartphone'],['24시간 지난 새 상담',data.overdue,'/admin/leads?status=접수완료&overdue=1','Phone'],['최근 갱신',data.sync?.status??'기록 없음','/admin/sync','BadgePercent']].map(([label,value,url,icon])=><Link to={url} key={label}><span className="card-icon"><Icon name={icon} size={22}/></span><strong>{value}</strong><span>{label}</span></Link>)}</div>
    <div className="admin-panels"><section className="admin-panel"><h2>오늘 확인할 일</h2><p>처리 대기 상담 {count('접수완료')}건</p><Link to="/admin/leads">상담 목록 보기 ›</Link></section><section className="admin-panel"><h2>지원금 갱신</h2><p>{data.sync?.message??'지원금 갱신 기록이 없습니다.'}</p><Link to="/admin/sync">실행 기록 보기 ›</Link></section></div></>}
  </>;
}
function Leads() {
  const [params,setParams]=useSearchParams(),[id,setId]=useState(''),[query,setQuery]=useState(params.get('q')||'');
  const resource=useResource('/admin/leads?'+params.toString()),detail=useResource(id?'/admin/leads/'+id:null);
  const [status,setStatus]=useState(''),[notes,setNotes]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{if(detail.data?.id===id&&detail.data){setStatus(detail.data.status);setNotes(detail.data.notes);setMessage('');}},[detail.data,id]);
  function filter(values) {setParams({...Object.fromEntries(params),page:'0',...values});}
  async function save(event) {
    event.preventDefault();setBusy(true);setMessage('');
    try {await api('/admin/leads/'+id,{method:'PATCH',body:{status,notes}});resource.retry();setMessage('상담 상태를 저장했습니다.');}catch(error){setMessage(error.message);}finally{setBusy(false);}
  }
  return <><h1>상담 접수</h1><section className="admin-panel"><form className="filters" onSubmit={e=>{e.preventDefault();filter({q:query});}}><label>상태<select value={params.get('status')||''} onChange={e=>filter({status:e.target.value})}><option value="">전체</option>{leadStates.map(state=><option key={state}>{state}</option>)}</select></label><label>신청번호·이름·전화<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="btn">검색</button></form>
    <Status resource={resource}/><div className="table-scroll"><table><thead><tr><th>신청번호</th><th>이름</th><th>유형</th><th>상태</th><th>접수 시간</th><th>상세</th></tr></thead><tbody>{resource.data?.items.map(item=><tr key={item.id}><td>{item.receipt}</td><td>{item.name}</td><td>{item.service}</td><td>{item.status}</td><td>{time(item.created_at)}</td><td><button className="btn" onClick={()=>setId(item.id)}>보기</button></td></tr>)}</tbody></table></div>{resource.data&&!resource.data.items.length&&<p className="message">해당 상담이 없습니다.</p>}
    <div className="actions"><button className="btn" disabled={Number(params.get('page')||0)<1} onClick={()=>filter({page:String(Number(params.get('page')||0)-1)})}>이전</button><button className="btn" disabled={!resource.data?.more} onClick={()=>filter({page:String(Number(params.get('page')||0)+1)})}>다음</button></div></section>
    {id&&<Modal title="상담 상세" onClose={()=>{if(!busy)setId('');}}><Status resource={detail}/>{detail.data?.id===id&&<form className="form-stack" onSubmit={save}><p>{detail.data.receipt} · {detail.data.service}</p><p>{detail.data.name} · {detail.data.phone} · {detail.data.birth}</p><p className="preserve">{detail.data.details}</p>
    <details><summary>신청 당시 견적·동의 기록</summary><pre>{JSON.stringify({quote:JSON.parse(detail.data.quote),consent:JSON.parse(detail.data.consent)},null,2)}</pre></details>
    <label>진행 상태<select value={status} onChange={e=>setStatus(e.target.value)}>{leadStates.map(state=><option key={state}>{state}</option>)}</select></label><label>관리 메모<textarea rows="4" value={notes} onChange={e=>setNotes(e.target.value)}/></label><button className="btn primary" disabled={busy}>저장</button>{message&&<p role="status">{message}</p>}</form>}</Modal>}
  </>;
}
function Sync() {
  const resource=useResource('/admin/sync'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  async function run() {
    setBusy(true);
    try {const result=await api('/admin/sync',{method:'POST'});setMessage(result.message);resource.retry();}catch(error){setMessage(error.message);}finally{setBusy(false);}
  }
  return <><div className="admin-head"><h1>지원금 갱신</h1><button className="btn primary" disabled={busy} onClick={run}>{busy?'갱신 중…':'지금 갱신'}</button></div><section className="admin-panel"><p>예약 실행은 한국시간 오전 9시입니다. 수동 지원금은 유효한 동안 우선 적용합니다.</p><details><summary>공개 조회 연결 방법</summary><p>요금제에 외부 요금제 코드를 먼저 입력하세요. 가격 조건의 외부 키는 SKT의 경우 skt:모델코드:5G, 스마트초이스의 경우 smartchoice:모델코드:5G:삼성전자 형식입니다. 금액과 요금제가 맞지 않으면 반영하지 않습니다.</p></details>{message&&<p role="status">{message}</p>}<Status resource={resource}/><ul className="sync-list">{resource.data?.map(row=><li key={row.id}><strong>{row.status}</strong> {time(row.created_at)}<p>{row.message}</p></li>)}</ul></section></>;
}
function Workspace({user,logout,site}) {
  const {section='dashboard'}=useParams(),[refs,setRefs]=useState({}),[error,setError]=useState(''),[nav,setNav]=useState(false);
  async function refresh() {
    try {
      const keys=['manufacturers','categories','products','capacities','carriers','plans','offers'];
      const pairs=await Promise.all(keys.map(async key=>[key,await api('/admin/'+key)]));
      setRefs(Object.fromEntries(pairs));setError('');
    } catch(error) {setError(error.message);}
  }
  useEffect(()=>{refresh();},[]);
  useEffect(()=>{setNav(false);window.scrollTo(0,0);},[section]);
  return <div className="admin-shell"><aside className={'admin-sidebar '+(nav?'open':'')}><Logo image={site.data?.appearance?.logo?.image}/><span className="admin-sidebar-label">관리자</span><nav aria-label="관리 메뉴"><NavLink end to="/admin">대시보드</NavLink>
    {groups.map(([label,keys])=><details key={label} open={keys.includes(section)||undefined}><summary>{label}</summary>{keys.map(key=><NavLink key={key} to={'/admin/'+key}>{entities[key]?.title||titles[key]}</NavLink>)}</details>)}</nav><button className="btn" onClick={logout}>로그아웃</button></aside>
    <main className="admin-main"><header className="admin-toolbar"><button className="btn admin-menu-toggle" aria-expanded={nav} onClick={()=>setNav(!nav)}>관리 메뉴 ☰</button><span>혜택소 관리자 › {entities[section]?.title||titles[section]||'대시보드'}</span><span>{user.username}</span></header>
      <div className="admin-work">{error&&<p role="alert" className="message error">{error} <button className="btn" onClick={refresh}>다시 시도</button></p>}
      {section==='dashboard'&&<Dashboard/>}
      {section==='appearance'&&<AppearanceEditor onChanged={site.retry}/>}
      {section==='phone-registration'&&<PhoneRegistration refs={refs} onChanged={refresh}/>}
      {section==='settings'&&<SiteSettings/>}
      {section==='excel'&&<Excel/>}
      {section==='leads'&&<Leads/>}
      {section==='sync'&&<Sync/>}
      {Object.hasOwn(entities,section)&&<Records key={section} entity={section} refs={refs} onChanged={refresh}/>}
      {section!=='dashboard'&&!Object.hasOwn(titles,section)&&!Object.hasOwn(entities,section)&&<h1>관리 메뉴를 찾을 수 없습니다.</h1>}</div>
    </main></div>;
}
export default function Admin() {
  const resource=useResource('/admin/session'),[user,setUser]=useState(null),[loggedOut,setLoggedOut]=useState(false),[error,setError]=useState('');
  useEffect(()=>{document.title='관리자 | 혜택소';},[]);
  const account=loggedOut?null:user||resource.data;
  const site=useResource(account?'/site':null);
  if(resource.loading&&!account)return <main className="login-page"><p>관리자 세션 확인 중…</p></main>;
  if(!account) {
    if(resource.error&&resource.error.status!==401&&!loggedOut)return <main className="login-page"><Status resource={resource}/></main>;
    return <Login logo={site.data?.appearance?.logo?.image} onLogin={account=>{setUser(account);setLoggedOut(false);}}/>;
  }
  async function logout(){try{await api('/admin/logout',{method:'POST'});setUser(null);setLoggedOut(true);}catch(error){setError(error.message);}}
  return <>{error&&<p role="alert" className="message error">{error}</p>}<Workspace user={account} logout={logout} site={site}/></>;
}
