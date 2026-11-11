import { BadgeCheck, BriefcaseBusiness, CarFront, Check, Clock, Gift, Handshake, Headset, Heart, House,
  KeyRound, MessageCircle, Percent, Phone, ShieldCheck, Smartphone, Truck, Tv, Wifi, Wrench } from 'lucide-react';
import { bannerIconLabels, bannerLineBreaks } from '../../../shared/banner-text.js';
import './banner-canvas.css';

const icons={
  smartphone:Smartphone,badge:BadgeCheck,headset:Headset,wrench:Wrench,wifi:Wifi,tv:Tv,
  shield:ShieldCheck,gift:Gift,percent:Percent,truck:Truck,home:House,car:CarFront,key:KeyRound,
  building:BriefcaseBusiness,handshake:Handshake,heart:Heart,phone:Phone,clock:Clock,message:MessageCircle,check:Check
};

export function BannerIcon({name}) {
  const Icon=Object.hasOwn(icons,name)?icons[name]:null;
  return Icon?<Icon aria-hidden="true" strokeWidth={1.7}/>:null;
}

export function BannerMedia({image,kind,fit,alt,playing=false}) {
  if (!image) return null;
  if (kind==='video') return <video src={image} style={{objectFit:fit}} muted playsInline autoPlay={playing} loop controls/>;
  return <picture>
    <img src={image} alt={alt||''} style={{objectFit:fit}}/>
  </picture>;
}

export function BannerTextPlane({layers,className='',editor,headingFallback}) {
  const textLayers=layers.filter(layer=>layer.type!=='icon'&&layer.text.trim());
  const heading=textLayers.find(layer=>layer.heading)??textLayers[0];
  return <div className={'banner-text-plane '+className}>
    {!editor&&!heading&&headingFallback&&<h1 className="banner-screen-reader-title">{headingFallback}</h1>}
    {layers.map(layer=>{
      const icon=layer.type==='icon';
      if (!editor&&!icon&&!layer.text.trim()) return null;
      const position={left:layer.x+'%',top:layer.y+'%',color:layer.color};
      const style = icon?{...position,
        width:`clamp(${Math.min(22,layer.size)}px, ${Number(layer.size)/7}cqw, ${layer.size}px)`,
        '--banner-icon-background':layer.background
      }:{
        ...position,textAlign:layer.align,
        maxWidth:`min(740px, ${100-layer.x}%)`,
        fontSize:`clamp(10px, ${Number(layer.size)/11}cqw, ${layer.size}px)`,
        fontWeight:layer.bold?800:500, margin:0, lineHeight:1.22
      };
      const className=icon?'banner-icon-item':'banner-text-item';
      const value=icon?<BannerIcon name={layer.icon}/>:bannerLineBreaks(layer.text);
      const description=icon?'아이콘 '+bannerIconLabels[layer.icon]:'문구 '+(layer.text.trim()||'빈 문구');
      if (editor) return <button key={layer.id} type="button" className={className+' banner-text-handle'}
        data-icon-shape={icon?layer.shape:undefined} aria-label={'미리보기 '+description} aria-pressed={editor.selected===layer.id}
        style={style} onClick={()=>editor.select(layer.id)} onPointerDown={event=>editor.start(event,layer)}
        onPointerMove={editor.move} onPointerUp={editor.stop} onPointerCancel={editor.stop}>
        {value||'빈 문구'}
      </button>;
      if(icon)return <span key={layer.id} className={className} style={style} data-icon-shape={layer.shape} aria-hidden="true">{value}</span>;
      const Tag = layer===heading?'h1':'div';
      return <Tag key={layer.id} className={className} style={style}>{value}</Tag>;
    })}
  </div>;
}
