import { createContext,useContext,useEffect,useState } from 'react';
import { Link,NavLink,Outlet,useLocation } from 'react-router-dom';
import { Moon,Sun } from 'lucide-react';
import { menuLabel, siteMenu } from '../../../shared/navigation.js';
import { useResource } from '../hooks/data.js';
import { Icon } from '../components/common.jsx';
import { defaultBrandImage } from '../../../shared/site-appearance.js';
import './site-theme.css';

const defaultSite={settings:{company:'혜택소'},banners:[],appearance:{}};
const SiteContext=createContext(defaultSite);
export const useSite=()=>useContext(SiteContext);
export function Logo({image}={}) {
  const {appearance}=useSite();
  return <Link className="brand" to="/" aria-label="혜택소 홈"><img src={image||appearance?.logo?.image||defaultBrandImage} alt="" width="43" height="43"/><span>혜택소</span></Link>;
}
export default function SiteLayout() {
  const site=useResource('/site'), config=site.data??defaultSite;
  const location=useLocation(),[menuOpen,setMenuOpen]=useState(false);
  const [dark,setDark]=useState(false);
  const {settings,navigation}=config;
  const favicon=config.appearance?.favicon?.image;
  useEffect(()=>setDark(document.documentElement.dataset.siteTheme==='dark'),[]);
  function toggleTheme() {
    const next=dark?'light':'dark';
    document.documentElement.dataset.siteTheme=next;
    setDark(next==='dark');
    try {localStorage.setItem('hyetaekso-site-theme',next);} catch {}
  }
  useEffect(()=>{
    const icon=document.querySelector('link[rel="icon"]');
    if(!icon)return;
    icon.href=favicon||defaultBrandImage;
    if(favicon)icon.removeAttribute('type');
    else icon.type='image/svg+xml';
  },[favicon]);
  useEffect(()=>{setMenuOpen(false);window.scrollTo(0,0);},[location.pathname]);
  useEffect(()=>{
    const key=location.pathname.split('/')[1];
    document.title=(menuLabel(key,navigation)??({phones:'휴대폰',consult:'상담 신청',lookup:'상담 조회'}[key]||'생활에 필요한 혜택'))+' | 혜택소';
  },[location.pathname,navigation]);
  useEffect(()=>{
    if(settings.motion==='off'||!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('entered');observer.unobserve(entry.target);}
    },{threshold:.08});
    const elements=document.querySelectorAll('[data-reveal]');
    elements.forEach(element=>{element.classList.add('will-reveal');observer.observe(element);});
    return ()=>{observer.disconnect();elements.forEach(el=>el.classList.remove('will-reveal','entered'));};
  },[location.pathname,settings.motion]);
  return <SiteContext.Provider value={config}><div className="site-shell">
    <a className="skip" href="#content">본문으로 바로가기</a>
    <header className="site-header">
      <div className="header-inner"><Logo/><button className="menu-toggle btn" aria-expanded={menuOpen} aria-controls="main-nav" onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen?'닫기':'메뉴 ☰'}</button>
      <nav id="main-nav" className={menuOpen?'nav-open':''} aria-label="주 메뉴">{siteMenu(navigation).map(([path,label])=><NavLink key={path} to={'/'+path}>{label}</NavLink>)}</nav>
      <div className="header-contact">
        {settings.phone&&<a href={'tel:'+settings.phone.replace(/[^+\d]/g,'')}><Icon name="Phone" size={17}/>{settings.phone}</a>}
        {settings.hours&&<small>{settings.hours}</small>}
        <div className="header-actions">
          <button type="button" className="btn theme-toggle" aria-label="다크 모드" aria-pressed={dark}
            title={dark?'라이트 모드로 전환':'다크 모드로 전환'} onClick={toggleTheme}>
            {dark?<Sun size={18} aria-hidden="true"/>:<Moon size={18} aria-hidden="true"/>}
          </button>
          <Link className="btn primary" to="/consult">상담 신청</Link>
        </div>
      </div></div>
    </header>
    <main id="content" key={location.pathname} className={'page '+(settings.motion==='off'?'no-motion':'')}><Outlet/></main>
    <footer className="site-footer"><div className="wrap footer-grid"><div><Logo/><p>{settings.company}</p>{settings.representative&&<p>대표이사 {settings.representative}</p>}{settings.registration&&<p>사업자등록번호 {settings.registration}</p>}{settings.address&&<p>{settings.address}</p>}</div>
      <div><strong>고객센터</strong>{settings.phone&&<p>{settings.phone}</p>}{settings.hours&&<p>{settings.hours}</p>}{settings.email&&<a href={'mailto:'+settings.email}>{settings.email}</a>}</div>
      <div><strong>바로가기</strong><Link to="/privacy">개인정보처리방침</Link><Link to="/terms">이용약관</Link><Link to="/support">고객센터</Link><Link to="/sitemap">사이트맵</Link></div>
      <div className="footer-sign">더 나은 일상의 시작<br/><b>혜택소</b><small>LIFE BENEFIT PLATFORM</small></div></div></footer>
  </div></SiteContext.Provider>;
}
