import { useEffect,useRef,useState } from 'react';
import { Link,useParams } from 'react-router-dom';
import { menu,pages,boardTitles } from './content.js';
import { Hero,Breadcrumb,Section,Steps,Callout,Art,Icon,Status,Modal } from '../components/common.jsx';
import { useSite } from '../layouts/SiteLayout.jsx';
import { useResource } from '../hooks/data.js';
import { homeHero, homePromises, heroAppearance, heroSlot, cardSlot, serviceCardTile } from '../../../shared/site-appearance.js';
import { menuLabel, siteMenu } from '../../../shared/navigation.js';
import { BannerMedia, BannerTextPlane } from '../components/BannerCanvas.jsx';
import { hasDocumentTitle, RichText } from '../components/RichText.jsx';
import { ConsultationLink } from '../components/ConsultationLink.jsx';
import { serviceByPage } from '../../../shared/consultation.js';
import { bannerLineBreaks } from '../../../shared/banner-text.js';

export function Banner() {
  const {banners,settings,appearance}=useSite(),[index,setIndex]=useState(0),[paused,pause]=useState(false),[hover,hovering]=useState(false);
  const reduced=typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const active=banners[index%banners.length];
  useEffect(()=>{
    if(!settings.banner_autoplay||paused||hover||reduced||banners.length<2)return;
    const timer=setInterval(()=>setIndex(i=>(i+1)%banners.length),1000*(settings.banner_interval||6));
    return ()=>clearInterval(timer);
  },[settings.banner_autoplay,settings.banner_interval,paused,hover,reduced,banners.length]);
  if(!active) {
    const visual=appearance?.[heroSlot('home')];
    const fallback=heroAppearance(homeHero,visual);
    return <Hero data={fallback} image={visual?.image || visual?.mobile} home/>;
  }
  const media=<BannerMedia image={active.image || (active.kind==='image'?active.mobile:'')} kind={active.kind} fit={active.fit} alt={active.alt} playing={!reduced}/>;
  const layered=Array.isArray(active.layers);
  return <section className={'banner '+(layered?'banner-layered':'')} aria-label="홈 배너" onMouseEnter={()=>hovering(true)} onMouseLeave={()=>hovering(false)} onFocus={()=>hovering(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))hovering(false);}}>
    {active.link&&active.kind!=='video'?<a href={active.link}>{media}</a>:media}
    {active.intro&&(layered?<BannerTextPlane layers={active.layers} className="banner-slide-plane" headingFallback={active.title}/>:<div className="banner-intro"><h1 className="preserve">{bannerLineBreaks(active.title)}</h1><p className="preserve">{bannerLineBreaks(active.body)}</p></div>)}
    {banners.length>1&&<div className="banner-controls"><button aria-label="이전 배너" onClick={()=>setIndex((index+banners.length-1)%banners.length)}>‹</button><span>{index+1} / {banners.length}</span><button aria-label="다음 배너" onClick={()=>setIndex((index+1)%banners.length)}>›</button>{settings.banner_autoplay&&!reduced&&<button aria-label={paused?'자동 넘김 재생':'자동 넘김 정지'} onClick={()=>pause(!paused)}>{paused?'▶':'Ⅱ'}</button>}</div>}
  </section>;
}
export function Home() {
  const {appearance,navigation}=useSite();
  const data=useResource('/products'),rail=useRef(null);
  return <><Banner/><nav className="service-bar wrap" aria-label="주요 서비스">{siteMenu(navigation).filter(([path])=>path!=='about').map(([path,label,detail,icon])=><Link to={'/'+path} key={path}><Icon name={icon} size={39}/><strong>{label}</strong><small>{detail}</small></Link>)}</nav>
    <Section title="최신 스마트폰 한눈에 보기" className="phone-showcase"><Link className="show-all" to="/phones">전체 모델 보기 ›</Link><Status resource={data}/>{data.data&&<div className="rail-wrap">
      <button className="rail-arrow prev" aria-label="이전 상품" onClick={()=>rail.current.scrollBy({left:-420,behavior:'smooth'})}>‹</button>
      <div className="product-rail" ref={rail}>{data.data.items.map(phone=><Link className="rail-item" to={'/phones/'+phone.id} key={phone.id}><small>{phone.sample?'전시 예시':phone.manufacturer}</small>{phone.image&&<img src={phone.image} alt="" loading="lazy"/>}<strong>{phone.name}</strong></Link>)}</div>
      <button className="rail-arrow next" aria-label="다음 상품" onClick={()=>rail.current.scrollBy({left:420,behavior:'smooth'})}>›</button>
      {!data.data.items.length&&<p className="message">공개된 휴대폰을 준비하고 있습니다.</p>}</div>}</Section>
    <Section title={<>혜택소가 <em>약속</em>드립니다</>} className="center"><div className="card-grid columns-3">{homePromises.map(([label,icon,tile],index)=>{
      const card=appearance?.[cardSlot('home',index)];
      return <article className="service-card" key={label}><Art tile={tile} src={card?.image}/><div className="card-body"><h3><Icon name={icon} size={22}/>{card?.title??label}</h3><p>{card?.description??'서비스에 맞는 조건과 이용 방법을 안내합니다.'}</p></div></article>;
    })}</div></Section></>;
}
function ServiceCards({data,slug,onInsurance}) {
  const {appearance}=useSite();
  const type=serviceByPage[slug];
  const columns=slug==='business'?6:slug==='insurance'||slug==='about'?5:slug==='telecom'?3:slug==='moving'?2:4;
  return <Section title={data.section} className={slug==='telecom'?'':'center'}>
    <div className={`card-grid columns-${columns}${slug==='moving'?' moving-service-cards':''}`}>
      {data.cards.map(([defaultTitle,icon,defaultDetail,defaultSecond,link],index)=>{
        const card=appearance?.[cardSlot(slug,index)];
        const title=card?.title??defaultTitle, detail=card?.description??defaultDetail, second=card?.secondary??defaultSecond;
        return <article className={'service-card '+(slug==='about'?'value-card':'')} key={defaultTitle}>
        {slug!=='about'&&<Art tile={serviceCardTile(slug,data,index)} src={card?.image}/>}
        <div className="card-body"><h3><span className="card-icon"><Icon name={icon} size={23}/></span>{title}</h3><p>{detail}</p>{second&&<p className="check-line"><Icon name="Check" size={15}/>{second}</p>}
        {slug==='insurance'?<button className="btn" onClick={()=>onInsurance({title,detail,second})}>자세히 보기 ›</button>:
          slug!=='about'&&(link?<Link className="btn" to={link}>자세히 보기 ›</Link>:
            <ConsultationLink className="btn" service={slug==='telecom'?defaultTitle:type} detail={title}>상담 신청 ›</ConsultationLink>)}</div>
      </article>;})}
    </div>
  </Section>;
}
const brands=[['현대','국산차','전기차','SUV','승용차'],['기아','국산차','전기차','하이브리드','승합차'],['제네시스','국산차','SUV','승용차'],['쉐보레','국산차','SUV'],['르노코리아','국산차','하이브리드','SUV'],['KG모빌리티','국산차','SUV'],['BMW','수입차','전기차','SUV','승용차'],['벤츠','수입차','전기차','승용차'],['아우디','수입차','SUV'],['폭스바겐','수입차','SUV'],['테슬라','수입차','전기차'],['볼보','수입차','하이브리드'],['렉서스','수입차','하이브리드'],['토요타','수입차','하이브리드'],['포르쉐','수입차','승용차'],['랜드로버','수입차','SUV']];
function MobilityBrands() {
  const [filter,setFilter]=useState('전체');
  return <Section title="다양한 브랜드와 차량을 만나보세요" className="center"><div className="tabs" aria-label="차량 분류">{['전체','국산차','수입차','전기차','하이브리드','SUV','승합차','승용차'].map(value=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value}</button>)}</div><div className="brands">{brands.filter(row=>filter==='전체'||row.includes(filter)).map(([brand])=><ConsultationLink key={brand} service="모빌리티" detail={brand}><Icon name="CarFront" size={22}/>{brand}</ConsultationLink>)}</div></Section>;
}
function AboutCompany({settings,image}) {
  const info=[
    ['상호',settings.company],['대표자',settings.representative],['사업자등록번호',settings.registration],
    ['주소',settings.address],['고객센터',settings.phone&&<a href={'tel:'+settings.phone.replace(/[^+\d]/g,'')}><strong>{settings.phone}</strong></a>],
    ['이메일',settings.email&&<a href={'mailto:'+settings.email}><strong>{settings.email}</strong></a>]
  ];
  return <><Section title={settings.about_title||'기업 소개'}><div className="about-panel"><Art tile={0} src={image}/><div>
    <RichText text={settings.about_intro} minHeading={3}/>
    <h3>{settings.about_info_title||'회사 정보'}</h3>
    <dl>{info.filter(([,value])=>value).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </div></div></Section><Steps title="사업 영역" items={['휴대폰·통신','인터넷·TV','생활 서비스','제휴·가맹']}/></>;
}
export function ServicePage({slug}) {
  const {settings,appearance,navigation}=useSite(),name=menuLabel(slug,navigation);
  const visual=appearance?.[heroSlot(slug)];
  const data=heroAppearance(pages[slug],visual);
  const [detail,setDetail]=useState(null);
  return <><Breadcrumb title={name}/><Hero data={data} image={visual?.image || visual?.mobile}/>
    {slug==='support'?<SupportBody/>:<>
      {slug==='mobility'&&<MobilityBrands/>}
      <ServiceCards data={data} slug={slug} onInsurance={setDetail}/>
      {slug==='about'&&<AboutCompany settings={settings} image={appearance?.['about-company']?.image}/>}
      {slug==='telecom'&&<Section title="통신 결합 할인"><div className="benefit-box"><span>인터넷</span><b>+</b><span>휴대폰</span><b>+</b><span>TV</span><b>=</b><span>결합 할인 상담</span></div></Section>}
      {slug==='rental'&&<RentalItems/>}
      <Callout title={slug==='about'?'함께 성장할 파트너를 찾습니다':name+' 상담이 필요하신가요?'} service={slug==='about'?'제휴·입점':serviceByPage[slug]} phone={settings.phone}/>
      {detail&&<Modal title={detail.title} onClose={()=>setDetail(null)}><p>{detail.detail}</p><p>{detail.second}</p><p className="message">보장과 가입 조건은 보험사와 개별 상품에 따라 달라집니다.</p></Modal>}
    </>}
    <ServiceArticles slug={slug}/>
  </>;
}
function ServiceArticles({slug}) {
  const {data}=useResource('/content/page?'+new URLSearchParams({category:'service:'+slug}));
  if(!data?.length)return null;
  return <Section title="추가 서비스 안내"><div className="card-grid columns-4">{data.map(item=><Link className="service-card card-body" key={item.id} to={'/board/page/'+item.id}>
    {item.image&&<img loading="lazy" src={item.image} alt=""/>}<h3>{item.title}</h3>
  </Link>)}</div></Section>;
}
function RentalItems() {
  const resource=useResource('/content/rental');
  return resource.data?.length?<Section title="등록된 렌탈 상품"><div className="card-grid columns-4">{resource.data.map(item=><Link className="service-card card-body" key={item.id} to={'/board/rental/'+item.id}>{item.image&&<img loading="lazy" src={item.image} alt=""/>}<h3>{item.title}</h3></Link>)}</div></Section>:null;
}
function SupportBody() {
  const {settings}=useSite(),faq=useResource('/content/faq'),[tab,setTab]=useState('전체');
  const topics=['전체','통신','렌탈','이사·홈','공간','모빌리티','사업자 서비스','가맹안내','기타'];
  return <><Section title="고객센터 문의 채널"><div className="card-grid columns-4">
    {[['전화 상담','Phone',settings.phone? <a href={'tel:'+settings.phone.replace(/[^+\d]/g,'')}>{settings.phone}</a>:'전화 안내 준비 중',settings.hours],
      ['온라인 문의','Headset',<ConsultationLink className="btn" service="고객문의">1:1 문의하기 ›</ConsultationLink>],
      ['카카오톡 상담','Users',settings.kakao?<a className="btn" href={settings.kakao}>상담하기 ›</a>:'상담 채널 준비 중'],
      ['이메일 문의','ClipboardList',settings.email?<a href={'mailto:'+settings.email}>{settings.email}</a>:'이메일 안내 준비 중']].map(([title,icon,action,note])=><article className="service-card contact-card" key={title}><Icon name={icon} size={36}/><h3>{title}</h3><div>{action}</div>{note&&<p>{note}</p>}</article>)}</div></Section>
    <Section title="자주 묻는 질문" description="고객들이 자주 문의하시는 내용을 모았습니다." className="center"><div className="tabs">{topics.map(topic=><button key={topic} aria-pressed={tab===topic} onClick={()=>setTab(topic)}>{topic}</button>)}</div><Status resource={faq}/><div className="faq-list">{faq.data?.filter(item=>tab==='전체'||item.category===tab).map(item=><details key={item.id}><summary><b>Q</b>{item.title}</summary><p>{item.body}</p></details>)}</div>{faq.data&&!faq.data.some(item=>tab==='전체'||item.category===tab)&&<p className="message">이 분류의 등록된 질문이 없습니다.</p>}</Section>
    <Callout title="고객의 소리에 귀 기울이겠습니다" service="고객의 소리"/></>;
}
export function Legal({kind}) {
  const {settings}=useSite();
  const title=kind==='privacy'?'개인정보처리방침':'이용약관',document=settings[kind];
  return <><Breadcrumb title={title}/><article className="legal-document wrap">
    {!hasDocumentTitle(document)&&<h1>{title}</h1>}
    <RichText minHeading={1} text={document||'등록을 준비하고 있습니다.'}/>
  </article></>;
}
export function Sitemap() {const {navigation}=useSite();return <Section title="사이트맵"><ul>{siteMenu(navigation).map(([path,label])=><li key={path}><Link to={'/'+path}>{label}</Link></li>)}<li><Link to="/phones">휴대폰 전체 모델</Link></li>{Object.entries(boardTitles).map(([key,title])=><li key={key}><Link to={'/board/'+key}>{title}</Link></li>)}</ul></Section>;}
