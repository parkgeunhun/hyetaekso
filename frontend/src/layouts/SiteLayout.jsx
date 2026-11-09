import { createContext,useContext,useEffect,useState } from 'react';
import { Link,NavLink,Outlet,useLocation } from 'react-router-dom';
import { menu } from '../pages/content.js';
import { useResource } from '../hooks/data.js';
import { Icon } from '../components/common.jsx';

const SiteContext=createContext({settings:{company:'혜택소'},banners:[]});
export const useSite=()=>useContext(SiteContext);
export function Logo() {return <Link className="brand" to="/" aria-label="혜택소 홈"><img src="/media/logo.svg" alt="" width="43" height="43"/><span>혜택소</span></Link>;}
export default function SiteLayout() {
  const site=useResource('/site'), config=site.data??{settings:{company:'혜택소'},banners:[]};
  const location=useLocation(),[menuOpen,setMenuOpen]=useState(false);
  const {settings}=config;
  useEffect(()=>{setMenuOpen(false);window.scrollTo(0,0);},[location.pathname]);
  useEffect(()=>{
    const key=location.pathname.split('/')[1];
    document.title=(menu.find(item=>item[0]===key)?.[1]??({phones:'휴대폰',consult:'상담 신청',lookup:'상담 조회'}[key]||'생활에 필요한 혜택'))+' | 혜택소';
  },[location.pathname]);
  useEffect(()=>{
    if(settings.motion==='off'||!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('entered');observer.unobserve(entry.target);}
    },{threshold:.08});
    const elements=document.querySelectorAll('[data-reveal]');
    elements.forEach(element=>{element.classList.add('will-reveal');observer.observe(element);});
    return ()=>{observer.disconnect();elements.forEach(el=>el.classList.remove('will-reveal','entered'));};
  },[location.pathname,settings.motion]);
  return <SiteContext.Provider value={config}>
    <a className="skip" href="#content">본문으로 바로가기</a>
    <header className={'site-header '+(location.pathname==='/insurance'?'insurance-header':'')}>
      <div className="header-inner"><Logo/><button className="menu-toggle btn" aria-expanded={menuOpen} aria-controls="main-nav" onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen?'닫기':'메뉴 ☰'}</button>
      <nav id="main-nav" className={menuOpen?'nav-open':''} aria-label="주 메뉴">{menu.map(([path,label])=><NavLink key={path} to={'/'+path}>{label}</NavLink>)}</nav>
      <div className="header-contact">{settings.phone&&<a href={'tel:'+settings.phone.replace(/[^+\d]/g,'')}><Icon name="Phone" size={17}/>{settings.phone}</a>}{settings.hours&&<small>{settings.hours}</small>}<Link className="btn primary" to="/consult">상담 신청</Link></div></div>
    </header>
    <main id="content" key={location.pathname} className={'page '+(settings.motion==='off'?'no-motion':'')}><Outlet/></main>
    <footer className="site-footer"><div className="wrap footer-grid"><div><Logo/><p>{settings.company}</p>{settings.representative&&<p>대표이사 {settings.representative}</p>}{settings.registration&&<p>사업자등록번호 {settings.registration}</p>}{settings.address&&<p>{settings.address}</p>}</div>
      <div><strong>고객센터</strong>{settings.phone&&<p>{settings.phone}</p>}{settings.hours&&<p>{settings.hours}</p>}{settings.email&&<a href={'mailto:'+settings.email}>{settings.email}</a>}</div>
      <div><strong>바로가기</strong><Link to="/privacy">개인정보처리방침</Link><Link to="/terms">이용약관</Link><Link to="/support">고객센터</Link><Link to="/sitemap">사이트맵</Link></div>
      <div className="footer-sign">더 나은 일상의 시작<br/><b>혜택소</b><small>LIFE BENEFIT PLATFORM</small></div></div></footer>
  </SiteContext.Provider>;
}
