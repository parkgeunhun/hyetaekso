import { bannerLineBreaks } from '../../../shared/banner-text.js';
import './banner-canvas.css';

export function BannerMedia({image,kind,fit,alt,playing=false}) {
  if (!image) return null;
  if (kind==='video') return <video src={image} style={{objectFit:fit}} muted playsInline autoPlay={playing} loop controls/>;
  return <picture>
    <img src={image} alt={alt||''} style={{objectFit:fit}}/>
  </picture>;
}

export function BannerTextPlane({layers,className='',editor,headingFallback}) {
  const heading = layers.find(layer=>layer.heading&&layer.text.trim()) ?? layers.find(layer=>layer.text.trim());
  return <div className={'banner-text-plane '+className}>
    {!editor&&!heading&&headingFallback&&<h1 className="banner-screen-reader-title">{headingFallback}</h1>}
    {layers.map(layer=>{
      if (!editor&&!layer.text.trim()) return null;
      const style = {
        left:layer.x+'%', top:layer.y+'%', color:layer.color,
        maxWidth:`min(740px, ${100-layer.x}%)`,
        fontSize:`clamp(10px, ${Number(layer.size)/11}cqw, ${layer.size}px)`,
        fontWeight:layer.bold?800:500, margin:0, lineHeight:1.22
      };
      const value=bannerLineBreaks(layer.text);
      if (editor) return <button key={layer.id} type="button" className="banner-text-item banner-text-handle"
        aria-label={'미리보기 문구 '+(layer.text.trim()||'빈 문구')} aria-pressed={editor.selected===layer.id}
        style={style} onClick={()=>editor.select(layer.id)} onPointerDown={event=>editor.start(event,layer)}
        onPointerMove={editor.move} onPointerUp={editor.stop} onPointerCancel={editor.stop}>
        {value||'빈 문구'}
      </button>;
      const Tag = layer===heading?'h1':'div';
      return <Tag key={layer.id} className="banner-text-item" style={style}>{value}</Tag>;
    })}
  </div>;
}
