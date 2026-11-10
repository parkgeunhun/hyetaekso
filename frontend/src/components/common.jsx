import { useEffect,useRef } from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, Building2, Droplet, House, LampFloor, CarFront, BriefcaseBusiness, Handshake, Headset, ShieldCheck, Users, BadgePercent, Heart, Wifi, Tv, Refrigerator, WashingMachine, AirVent, Wind, Armchair, CookingPot, Truck, Sparkles, PanelsTopLeft, Store, Car, Zap, Phone, Printer, ChartNoAxesCombined, GraduationCap, HeartPulse, Baby, HeartHandshake, ClipboardList, Check, ArrowRight } from 'lucide-react';

const icons={Smartphone,Building2,Droplet,House,LampFloor,CarFront,BriefcaseBusiness,Handshake,Headset,ShieldCheck,Users,BadgePercent,Heart,Wifi,Tv,Refrigerator,WashingMachine,AirVent,Wind,Armchair,CookingPot,Truck,Sparkles,PanelsTopLeft,Store,Car,Zap,Phone,Printer,ChartNoAxesCombined,GraduationCap,HeartPulse,Baby,HeartHandshake,ClipboardList,Check,ArrowRight};
export function Icon({name,size=28}) { const Component=icons[name]||Check;return <Component size={size} strokeWidth={1.7} aria-hidden="true"/>; }
export function Art({tile=0,className='',src,mobile}) {
  return <div aria-hidden="true" className={'service-art '+(src?'service-art-custom ':'')+className} style={{backgroundPosition:(tile%3)*50+'% '+Math.floor(tile/3)*50+'%'}}>
    {(src||mobile)&&<picture className={src?undefined:'art-mobile-only'}>
      {mobile&&<source media="(max-width:600px)" srcSet={mobile}/>}
      <img src={src||undefined} alt=""/>
    </picture>}
  </div>;
}
export function Hero({data,children,home=false,image,mobile}) {
  return <section className={'hero '+(data.dark?'hero-dark ':'')+(home?'hero-home':'')}>
    {home?<picture className="home-scene">{mobile&&<source media="(max-width:600px)" srcSet={mobile}/>}<img src={image||'/media/showroom.png'} alt=""/></picture>:<Art tile={data.tile} src={image} mobile={mobile}/>}
    <div className="hero-shade"/><div className="hero-inner wrap">
      {data.kicker&&<p className="eyebrow">{data.kicker}</p>}
      <h1>{data.title[0]}{data.title[1]&&<>{data.title[0]&&<br/>}<em>{data.title[1]}</em></>}</h1>
      {data.description&&<p className="hero-description preserve">{data.description}</p>}
      {data.features?.length>0&&<div className="hero-features">{data.features.map((label,i)=><span key={i}><Icon name={['ShieldCheck','Users','ClipboardList','Headset'][i]} size={21}/>{label}</span>)}</div>}
      {children}
    </div>
  </section>;
}
export function Breadcrumb({title}) {return <nav className="breadcrumb wrap" aria-label="현재 위치"><Link to="/">홈</Link><span aria-hidden="true">›</span><strong>{title}</strong></nav>;}
export function Section({title,description,children,className=''}) {return <section className={'section wrap '+className} data-reveal><header className="section-head"><h2>{title}</h2>{description&&<p>{description}</p>}</header>{children}</section>;}
export function Steps({title,items}) {return <Section title={title}><ol className="steps">{items.map((label,i)=><li key={label}><span className="step-icon"><Icon name={['Headset','ClipboardList','Handshake','BadgePercent','Check','Truck','ShieldCheck'][i%7]}/></span><b>{i+1}. {label}</b></li>)}</ol></Section>;}
export function Callout({title,service,phone,detail}) {return <section className="callout wrap" data-reveal><div><h2>{title}</h2><p>필요한 조건을 남겨주시면 상담에서 함께 확인합니다.</p></div><Link className="btn primary" to={'/consult?service='+encodeURIComponent(service)+(detail?'&detail='+encodeURIComponent(detail):'')}>상담 신청하기 <Icon name="ArrowRight" size={17}/></Link>{phone&&<a className="btn light-outline" href={'tel:'+phone.replace(/[^+\d]/g,'')}>전화 문의하기</a>}</section>;}
export function Status({resource}) {
  if(resource.loading)return <p role="status" className="message">불러오는 중…</p>;
  if(resource.error)return <div className="message error" role="alert">{resource.error.message} <button className="btn" onClick={resource.retry}>다시 시도</button></div>;
  return null;
}
export function Modal({title,children,onClose}) {
  const dialog=useRef(null);
  useEffect(()=>{const node=dialog.current;node.showModal();return ()=>node.close();},[]);
  return <dialog ref={dialog} onCancel={event=>{event.preventDefault();event.stopPropagation();onClose();}} className="dialog"><header><h2>{title}</h2><button className="btn" type="button" onClick={onClose} aria-label="닫기">×</button></header>{children}</dialog>;
}
