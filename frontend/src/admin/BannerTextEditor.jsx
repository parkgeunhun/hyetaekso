import { useRef, useState } from 'react';
import { defaultHeroLayers, defaultSlideLayers, maxBannerLayers, maxBannerText, newBannerLayer } from '../../../shared/banner-text.js';
import { BannerMedia, BannerTextPlane } from '../components/BannerCanvas.jsx';
import { Hero } from '../components/common.jsx';

const clampPosition = value => Math.max(0,Math.min(100,Math.round(value)));

export default function BannerTextEditor({hero,form,onChange,home=false}) {
  const defaults=hero?defaultHeroLayers(hero):defaultSlideLayers(form);
  const layers=form.layers??defaults;
  const [selectedId,setSelected]=useState('');
  const [narrow,setNarrow]=useState(false);
  const drag=useRef(null);
  const selected=layers.find(layer=>layer.id===selectedId)??layers[0];

  function update(id,values) {
    onChange(layers.map(layer=>layer.id===id?{...layer,...values}:layer));
  }

  function addText() {
    const layer=newBannerLayer(crypto.randomUUID());
    if(hero&&!hero.dark)layer.color='#17202c';
    layer.y=Math.min(90,14+layers.length*6);
    setSelected(layer.id);
    onChange([...layers,layer]);
  }

  const editor={
    selected:selected?.id,
    select:setSelected,
    start(event,layer) {
      if(event.button!==0)return;
      event.preventDefault();
      setSelected(layer.id);
      const bounds=event.currentTarget.parentElement.getBoundingClientRect();
      drag.current={id:layer.id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,
        x:Number(layer.x),y:Number(layer.y),width:bounds.width,height:bounds.height};
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    move(event) {
      const current=drag.current;
      if(!current||current.pointerId!==event.pointerId)return;
      const x=clampPosition(current.x+(event.clientX-current.startX)*100/current.width);
      const y=clampPosition(current.y+(event.clientY-current.startY)*100/current.height);
      const prior=layers.find(layer=>layer.id===current.id);
      if(prior&&(x!==prior.x||y!==prior.y))update(current.id,{x,y});
    },
    stop(event) {
      if(drag.current?.pointerId===event.pointerId)drag.current=null;
    }
  };
  return <section className="banner-editor" aria-label="배너 텍스트 편집기">
    <div className="admin-head"><div><h2>배너 텍스트 편집기</h2><p>미리보기에서 문구를 끌어 옮기거나 아래에 X/Y 좌표를 입력하세요.</p></div>
      <button className="btn" type="button" onClick={addText} disabled={layers.length>=maxBannerLayers}>+ 텍스트 추가</button>
    </div>
    <div className="actions" aria-label="미리보기 크기">
      <button className="btn" type="button" aria-pressed={!narrow} onClick={()=>setNarrow(false)}>넓게</button>
      <button className="btn" type="button" aria-pressed={narrow} onClick={()=>setNarrow(true)}>휴대폰</button>
      <small>미리보기 · 좌표는 배너 문구 영역의 왼쪽·위 기준 %</small>
    </div>
    <div className={'banner-editor-preview '+(narrow?'banner-editor-preview-narrow':'')}>
      {hero?<Hero data={{...hero,layers}} home={home} image={form.image} editor={editor}/>:<div className="banner banner-layered banner-editor-slide">
        <BannerMedia image={form.image} kind={form.kind} fit={form.fit} alt={form.alt}/>
        <BannerTextPlane className="banner-slide-plane" layers={layers} editor={editor}/>
      </div>}
    </div>
    {selected&&<div className="banner-editor-controls">
      <div className="actions">
        <label>편집할 문구<select value={selected.id} onChange={event=>setSelected(event.target.value)}>
          {layers.map((layer,index)=><option key={layer.id} value={layer.id}>{index+1}. {layer.text.trim().slice(0,35)||'빈 문구'}</option>)}
        </select></label>
        <button className="btn" type="button" onClick={()=>onChange(layers.filter(layer=>layer.id!==selected.id))}>문구 삭제</button>
      </div>
      <label>문구 내용 <small>{'\\r\\n 입력 시 줄바꿈 지원'}</small>
        <textarea aria-label="문구 내용" rows="3" maxLength={maxBannerText} value={selected.text}
          onChange={event=>update(selected.id,{text:event.target.value})}/>
      </label>
      <div className="banner-editor-properties">
        <label>글자 색상<input type="color" value={selected.color} onChange={event=>update(selected.id,{color:event.target.value})}/></label>
        <label>글자 크기 (px)<input type="number" min="10" max="120" required value={selected.size} onChange={event=>update(selected.id,{size:event.target.value})}/></label>
        <label>X 좌표 (%)<input type="number" min="0" max="100" required value={selected.x} onChange={event=>update(selected.id,{x:event.target.value})}/></label>
        <label>Y 좌표 (%)<input type="number" min="0" max="100" required value={selected.y} onChange={event=>update(selected.id,{y:event.target.value})}/></label>
        <label className="checkbox"><input type="checkbox" checked={selected.bold} onChange={event=>update(selected.id,{bold:event.target.checked})}/>굵게</label>
      </div>
    </div>}
    {form.layers==null?<button className="btn" type="button" onClick={()=>onChange(defaults)}>이 배치 적용</button>:
      <button className="btn" type="button" onClick={()=>{setSelected('');onChange(null);}}>기존 문구 배치로 복원</button>}
  </section>;
}
