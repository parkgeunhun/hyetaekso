import { useEffect,useState } from 'react';
import { Link,useLocation,useParams,useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { useResource } from '../hooks/data.js';
import { Logo } from '../layouts/SiteLayout.jsx';
import { Icon,Status,Modal } from '../components/common.jsx';
import { entities,leadStates } from './fields.js';
import { Records,SiteSettings,Excel } from './Editors.jsx';
import AppearanceEditor from './AppearanceEditor.jsx';
import ImageLibrary from './ImageLibrary.jsx';
import NavigationEditor from './NavigationEditor.jsx';
import PhoneRegistration from './PhoneRegistration.jsx';
import { boardTitles, menu, serviceTypes } from '../pages/content.js';
import { mediaCategories } from '../../../shared/media-library.js';
import './admin.css';

const pageSections=Object.fromEntries([['page-home','홈'],...menu.map(([slug,label])=>['page-'+slug,label])]);
const serviceSections=Object.fromEntries(menu.map(([slug,label])=>['service-'+slug,{slug,label}]));
const boardSections=Object.fromEntries(Object.keys(boardTitles).map(kind=>['board-'+kind,kind]));
const imageSections={images:'all',...Object.fromEntries(Object.keys(mediaCategories).map(category=>['images-'+category,category]))};
const settingSections={
  settings:['motion'],
  contact:['company','phone','email','hours','address','registration','representative','kakao'],
  privacy:['privacy','consent'],
  terms:['terms'],
  'phone-guide':['join_change','join_new','join_port','help_enabled','help_text'],
  'support-sources':['skt_notice','sc_price'],
  'intake-settings':['intake','retention_days','success_text']
};
const bannerSettings=['banner_autoplay','banner_interval'];
const titles={
  ...pageSections,
  ...Object.fromEntries(Object.entries(serviceSections).map(([section,{label}])=>[section,label+' 추가 안내'])),
  ...Object.fromEntries(Object.entries(boardSections).map(([section,kind])=>[section,boardTitles[kind]])),
  ...Object.fromEntries(Object.entries(imageSections).map(([section,category])=>[section,mediaCategories[category]??'전체 이미지'])),
  sync:'지원금 갱신',excel:'엑셀 일괄 작업',leads:'상담 접수',settings:'화면 움직임',
  appearance:'로고·탭 아이콘',navigation:'메뉴 관리',contact:'회사·고객센터 정보',privacy:'개인정보처리방침',
  terms:'이용약관','phone-registration':'휴대폰 등록','phone-guide':'휴대폰 안내 문구',
  'support-sources':'지원금 조회 주소','intake-settings':'상담 접수 설정','board-page':'일반 안내 게시판'
};
const link=(section,label=entities[section]?.title||titles[section])=>({section,label});
const consultation=service=>({section:'leads',service,label:service+' 상담'});
const serviceConsultations={
  telecom:['휴대폰','인터넷','TV'],
  rental:['렌탈'],
  moving:['이사·홈'],
  space:['공간'],
  mobility:['모빌리티'],
  business:['사업자 서비스'],
  franchise:['가맹안내','제휴·입점'],
  support:['고객문의','고객의 소리']
};
const serviceTools={
  telecom:[
    {label:'휴대폰 관리',items:['phone-registration','products','manufacturers','categories','capacities','colors','phone-guide'].map(section=>link(section))},
    {label:'요금제·지원금',items:['carriers','plans','offers','supports','sync','support-sources'].map(section=>link(section))}
  ],
  rental:[link('board-rental')],
  support:[link('leads','전체 상담'),...['intake-settings','board-notice','board-faq','board-review','board-qna','board-page','contact','privacy','terms'].map(section=>link(section))]
};
const groups=[
  {label:'홈',items:[link('page-home','홈 기본 화면'),link('banners')]},
  ...menu.map(([slug,label])=>({label,items:[
    link('page-'+slug,'화면·배너'),
    link('service-'+slug,'추가 안내'),
    ...(serviceTools[slug]??[]),
    ...(serviceConsultations[slug]??[]).map(consultation)
  ]})),
  {label:'이미지',items:Object.keys(imageSections).map(section=>link(section))},
  {label:'공통 설정',items:[link('navigation'),link('appearance'),link('settings'),link('excel')]}
];

function SidebarItem({item,isActive,onNavigate}) {
  if(item.items) {
    const hasActive=entry=>entry.items?entry.items.some(hasActive):isActive(entry);
    return <details open={item.items.some(hasActive)||undefined}>
      <summary>{item.label}</summary>
      {item.items.map(entry=><SidebarItem key={entry.service??entry.section??entry.label} item={entry} isActive={isActive} onNavigate={onNavigate}/>)}
    </details>;
  }
  const path=item.section==='dashboard'?'/admin':'/admin/'+item.section;
  const target=item.service?path+'?'+new URLSearchParams({service:item.service}):path;
  const active=isActive(item);
  return <Link to={target} className={active?'active':undefined} aria-current={active?'page':undefined} onClick={onNavigate}>{item.label}</Link>;
}
const time=(value,timeZone)=>value?new Date(Number(value)).toLocaleString('ko-KR',{timeZone}):'기록 없음';
const syncLabels={unconfigured:'연결 설정 필요',success:'갱신 완료',partial:'일부 갱신',empty:'일치 조건 없음',failed:'갱신 실패'};
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
  return <><div className="admin-head"><div><h1>대시보드</h1><p>상담 접수, 공개 상품과 지원금 상태를 확인하세요.</p></div><div className="actions"><Link className="btn primary" to="/admin/phone-registration">휴대폰 등록</Link><Link className="btn" to="/admin/navigation">메뉴 관리</Link><Link className="btn" to="/admin/banners">홈 배너</Link></div></div><Status resource={resource}/>
    {data&&<><div className="admin-metrics">{[['새 상담',count('접수완료'),'/admin/leads?status=접수완료','ClipboardList'],['상담 중',count('상담중'),'/admin/leads?status=상담중','Headset'],['상담 완료',count('상담완료'),'/admin/leads?status=상담완료','Check'],['공개 휴대폰',data.products,'/admin/products','Smartphone'],['24시간 지난 새 상담',data.overdue,'/admin/leads?status=접수완료&overdue=1','Phone'],['최근 갱신',syncLabels[data.sync?.status]??data.sync?.status??'기록 없음','/admin/sync','BadgePercent']].map(([label,value,url,icon])=><Link to={url} key={label}><span className="card-icon"><Icon name={icon} size={22}/></span><strong>{value}</strong><span>{label}</span></Link>)}</div>
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
  return <><h1>{params.get('service')?params.get('service')+' 상담':'상담 접수'}</h1><section className="admin-panel"><form className="filters" onSubmit={e=>{e.preventDefault();filter({q:query});}}><label>상태<select value={params.get('status')||''} onChange={e=>filter({status:e.target.value})}><option value="">전체</option>{leadStates.map(state=><option key={state}>{state}</option>)}</select></label><label>상담 유형<select value={params.get('service')||''} onChange={e=>filter({service:e.target.value})}><option value="">전체</option>{serviceTypes.map(service=><option key={service}>{service}</option>)}</select></label><label>신청번호·이름·전화<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="btn">검색</button></form>
    <Status resource={resource}/><div className="table-scroll"><table><thead><tr><th>신청번호</th><th>이름</th><th>유형</th><th>상태</th><th>접수 시간</th><th>상세</th></tr></thead><tbody>{resource.data?.items.map(item=><tr key={item.id}><td>{item.receipt}</td><td>{item.name}</td><td>{item.service}</td><td>{item.status}</td><td>{time(item.created_at)}</td><td><button className="btn" onClick={()=>setId(item.id)}>보기</button></td></tr>)}</tbody></table></div>{resource.data&&!resource.data.items.length&&<p className="message">해당 상담이 없습니다.</p>}
    <div className="actions"><button className="btn" disabled={Number(params.get('page')||0)<1} onClick={()=>filter({page:String(Number(params.get('page')||0)-1)})}>이전</button><button className="btn" disabled={!resource.data?.more} onClick={()=>filter({page:String(Number(params.get('page')||0)+1)})}>다음</button></div></section>
    {id&&<Modal title="상담 상세" onClose={()=>{if(!busy)setId('');}}><Status resource={detail}/>{detail.data?.id===id&&<form className="form-stack" onSubmit={save}><p>{detail.data.receipt} · {detail.data.service}</p><p>{detail.data.name} · {detail.data.phone} · {detail.data.birth}</p><p className="preserve">{detail.data.details}</p>
    <details><summary>신청 당시 견적·동의 기록</summary><pre>{JSON.stringify({quote:JSON.parse(detail.data.quote),consent:JSON.parse(detail.data.consent)},null,2)}</pre></details>
    <label>진행 상태<select value={status} onChange={e=>setStatus(e.target.value)}>{leadStates.map(state=><option key={state}>{state}</option>)}</select></label><label>관리 메모<textarea rows="4" value={notes} onChange={e=>setNotes(e.target.value)}/></label><button className="btn primary" disabled={busy}>저장</button>{message&&<p role="status">{message}</p>}</form>}</Modal>}
  </>;
}
function Sync() {
  const resource=useResource('/admin/sync'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const status=useResource('/admin/sync/status'),summary=status.data;
  async function run() {
    setBusy(true);
    try {const result=await api('/admin/sync',{method:'POST'});setMessage(result.message);resource.retry();status.retry();}catch(error){setMessage(error.message);}finally{setBusy(false);}
  }
  return <>
    <div className="admin-head"><h1>지원금 갱신</h1><button className="btn primary" disabled={busy||summary?.ready===0} onClick={run}>{busy?'갱신 중…':'지금 갱신'}</button></div>
    <section className="admin-panel">
      <h2>공개 조회 연결 상태</h2>
      <p>매일 오전 9시(한국시간)에 연결된 가격 조건을 갱신합니다. 유효한 수동 지원금을 우선 적용합니다.</p>
      <Status resource={status}/>
      {summary&&<>
        <p className="message">활성 가격 조건 {summary.total}개 중 자동 갱신 가능 {summary.ready}개</p>
        <ul className="sync-list">
          {summary.unlinked>0&&<li>공개 조회 매핑 없음 {summary.unlinked}개. <Link to="/admin/offers">가격 조건 열기</Link></li>}
          {summary.missingPlan>0&&<li>외부 요금제 코드 없음 {summary.missingPlan}개. <Link to="/admin/plans">요금제 관리 열기</Link></li>}
          {summary.invalidMapping>0&&<li>통신사 또는 매핑 형식 확인 필요 {summary.invalidMapping}개</li>}
          {summary.missingFeed>0&&<li>별도 피드 연결 필요 {summary.missingFeed}개</li>}
        </ul>
      </>}
      <details><summary>공개 조회 연결 방법</summary>
        <ol>
          <li><Link to="/admin/plans">요금제 관리</Link>에서 실제 통신사의 외부 요금제 코드를 입력합니다.</li>
          <li><Link to="/admin/offers">가격 조건</Link>에서 단말을 연결합니다. SKT는 <code>skt:모델코드:5G</code>, 스마트초이스는 <code>smartchoice:모델코드:5G:삼성전자</code> 형식입니다.</li>
        </ol>
        <p>통신사, 용량, 출고가와 월정액이 공개 자료와 일치하는 조건만 반영됩니다. 예시 상품은 실제 단말과 요금제로 등록한 뒤 연결하세요.</p>
      </details>
    </section>
    <section className="admin-panel">
      <h2>최근 갱신 기록</h2>
      {message&&<p role="status">{message}</p>}<Status resource={resource}/>
      <ul className="sync-list">{resource.data?.map(row=><li key={row.id}><strong>{syncLabels[row.status]??row.status}</strong> {time(row.created_at,'Asia/Seoul')}<p>{row.message}</p></li>)}</ul>
    </section>
  </>;
}
function Workspace({user,logout,site}) {
  const {section='dashboard'}=useParams(),[refs,setRefs]=useState({}),[error,setError]=useState(''),[nav,setNav]=useState(false);
  const {search}=useLocation();
  const service=section==='leads'?new URLSearchParams(search).get('service')||'':'';
  const isActive=item=>item.section===section&&(item.service??'')===service;
  const servicePage=Object.hasOwn(serviceSections,section)?serviceSections[section]:null;
  const closeMenu=()=>setNav(false);
  async function refresh() {
    try {
      const keys=['manufacturers','categories','products','capacities','carriers','plans','offers'];
      const pairs=await Promise.all(keys.map(async key=>[key,await api('/admin/'+key)]));
      setRefs(Object.fromEntries(pairs));setError('');
    } catch(error) {setError(error.message);}
  }
  useEffect(()=>{refresh();},[]);
  useEffect(()=>{setNav(false);window.scrollTo(0,0);},[section,service]);
  return <div className="admin-shell"><aside id="admin-sidebar" className={'admin-sidebar '+(nav?'open':'')}><Logo image={site.data?.appearance?.logo?.image}/><button type="button" className="btn admin-menu-close" onClick={closeMenu}>메뉴 닫기</button><span className="admin-sidebar-label">관리자</span>
    <nav aria-label="관리 메뉴">
      <SidebarItem item={link('dashboard','대시보드')} isActive={isActive} onNavigate={closeMenu}/>
      {groups.map(group=><SidebarItem key={group.label} item={group} isActive={isActive} onNavigate={closeMenu}/>)}
    </nav><button className="btn" onClick={logout}>로그아웃</button></aside>
    <main className="admin-main"><header className="admin-toolbar"><button className="btn admin-menu-toggle" aria-controls="admin-sidebar" aria-expanded={nav} onClick={()=>setNav(!nav)}>관리 메뉴 ☰</button><span>혜택소 관리자 › {service?service+' 상담':entities[section]?.title||titles[section]||'대시보드'}</span><span>{user.username}</span></header>
      <div className="admin-work">{error&&<p role="alert" className="message error">{error} <button className="btn" onClick={refresh}>다시 시도</button></p>}
      {section==='dashboard'&&<Dashboard/>}
      {section==='appearance'&&<AppearanceEditor page="공통" onChanged={site.retry}/>}
      {Object.hasOwn(pageSections,section)&&<AppearanceEditor key={section} page={pageSections[section]} onChanged={site.retry}/>}
      {servicePage&&<Records key={section} entity="content" kind="page" category={'service:'+servicePage.slug} title={titles[section]} onChanged={site.retry}/>}
      {section==='navigation'&&<NavigationEditor onChanged={site.retry}/>}
      {Object.hasOwn(imageSections,section)&&<ImageLibrary key={section} category={imageSections[section]} title={titles[section]}/>}
      {section==='phone-registration'&&<PhoneRegistration refs={refs} onChanged={refresh}/>}
      {Object.hasOwn(settingSections,section)&&<SiteSettings key={section} only={settingSections[section]} title={titles[section]} onChanged={site.retry}/>}
      {section==='excel'&&<Excel/>}
      {section==='leads'&&<Leads key={service}/>}
      {section==='sync'&&<Sync/>}
      {Object.hasOwn(entities,section)&&<Records key={section} entity={section} refs={refs} onChanged={section==='banners'?site.retry:refresh}/>}
      {section==='banners'&&<SiteSettings only={bannerSettings} title="슬라이드 재생 설정" subsection onChanged={site.retry}/>}
      {Object.hasOwn(boardSections,section)&&<Records key={section} entity="content" kind={boardSections[section]} title={titles[section]} general={section==='board-page'} onChanged={site.retry}/>}
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
