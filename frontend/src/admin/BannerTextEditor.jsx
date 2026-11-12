import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, ImagePlus, Monitor, Smartphone, Trash2, Type } from 'lucide-react';
import { bannerIconLabels, bannerIconShapes, bannerTextAlignments, defaultHeroLayers, defaultSlideLayers,
  maxBannerLayers, maxBannerText, newBannerIcon, newBannerLayer } from '../../../shared/banner-text.js';
import { BannerIcon, BannerMedia, BannerTextPlane } from '../components/BannerCanvas.jsx';
import { Hero } from '../components/common.jsx';

const clampPosition = value => Math.max(0,Math.min(100,Math.round(value)));
const layerName=layer=>layer.type==='icon'?bannerIconLabels[layer.icon]:layer.text.trim().slice(0,35)||'빈 문구';

export default function BannerTextEditor({hero,form,onChange,home=false}) {
  const defaults=hero?defaultHeroLayers(hero):defaultSlideLayers(form);
  const layers=form.layers??defaults;
  const [selectedId,setSelected]=useState('');
  const [narrow,setNarrow]=useState(false);
  const [showIcons,setShowIcons]=useState(false);
  const drag=useRef(null);
  const selected=layers.find(layer=>layer.id===selectedId)??layers[0];
  const selectedIndex=layers.indexOf(selected);
  const isIcon=selected?.type==='icon';
  const full=layers.length>=maxBannerLayers;

  function update(id,values) {
    onChange(layers.map(layer=>layer.id===id?{...layer,...values}:layer));
  }

  function addText() {
    const layer=newBannerLayer(crypto.randomUUID());
    if(hero&&!hero.dark)layer.color='#17202c';
    layer.y=Math.min(90,14+layers.length*6);
    addLayer(layer);
  }

  function addLayer(layer) {
    setSelected(layer.id);
    onChange([...layers,layer]);
  }

  function addIcon(name) {
    addLayer(newBannerIcon(crypto.randomUUID(),name,layers.filter(layer=>layer.type==='icon').length));
    setShowIcons(false);
  }

  function duplicate() {
    addLayer({...selected,id:crypto.randomUUID(),
      x:Math.min(93,Number(selected.x)+3),y:Math.min(93,Number(selected.y)+3),
      ...(isIcon?{}:{heading:false})});
  }

  function reorder(step) {
    const next=[...layers];
    const target=selectedIndex+step;
    if(target<0||target>=next.length)return;
    next.splice(selectedIndex,1);
    next.splice(target,0,selected);
    onChange(next);
  }

  function remove() {
    const next=layers.filter(layer=>layer.id!==selected.id);
    setSelected(next[Math.min(selectedIndex,next.length-1)]?.id??'');
    onChange(next);
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
  return <section className="banner-editor" aria-label="배너 편집기">
    <div className="admin-head banner-editor-toolbar">
      <div><h2>배너 편집기</h2><p>글자나 아이콘을 추가하고 미리보기에서 원하는 위치로 끌어 옮기세요.</p></div>
      <div className="actions" role="group" aria-label="미리보기 크기">
        <button className="btn" type="button" aria-pressed={!narrow} onClick={()=>setNarrow(false)}><Monitor size={17} aria-hidden="true"/>넓게</button>
        <button className="btn" type="button" aria-pressed={narrow} onClick={()=>setNarrow(true)}><Smartphone size={17} aria-hidden="true"/>휴대폰</button>
      </div>
    </div>
    <div className="banner-editor-stage"><div className={'banner-editor-preview '+(narrow?'banner-editor-preview-narrow':'')}>
      {hero?<Hero data={{...hero,layers}} home={home} image={form.image} editor={editor}/>:<div className="banner banner-layered banner-editor-slide">
        <BannerMedia image={form.image} kind={form.kind} fit={form.fit} alt={form.alt}/>
        <BannerTextPlane className="banner-slide-plane" layers={layers} editor={editor}/>
      </div>}
    </div></div>
    <div className="banner-editor-controls">
      <div className="actions" role="group" aria-label="요소 추가">
        <button className="btn" type="button" onClick={addText} disabled={full}><Type size={17} aria-hidden="true"/>텍스트 추가</button>
        <button className="btn" type="button" onClick={()=>setShowIcons(!showIcons)} aria-expanded={showIcons}
          disabled={full&&!showIcons}><ImagePlus size={17} aria-hidden="true"/>아이콘 넣기</button>
      </div>
      {full&&<p className="message">배너에 최대 {maxBannerLayers}개 요소를 넣을 수 있습니다.</p>}
      {selected&&<div className="actions">
        <label>편집할 요소<select aria-label="편집할 요소" value={selected.id} onChange={event=>setSelected(event.target.value)}>
          {layers.map((layer,index)=><option key={layer.id} value={layer.id}>{index+1}. {layer.type==='icon'?'아이콘':'텍스트'} · {layerName(layer)}</option>)}
        </select></label>
        <div className="actions banner-layer-actions">
          <button className="btn" type="button" aria-label="한 단계 앞으로" title="한 단계 앞으로" disabled={selectedIndex===layers.length-1} onClick={()=>reorder(1)}><ArrowUp size={16} aria-hidden="true"/></button>
          <button className="btn" type="button" aria-label="한 단계 뒤로" title="한 단계 뒤로" disabled={selectedIndex===0} onClick={()=>reorder(-1)}><ArrowDown size={16} aria-hidden="true"/></button>
          <button className="btn" type="button" aria-label="선택 요소 복제" title="복제" disabled={full} onClick={duplicate}><Copy size={16} aria-hidden="true"/></button>
          <button className="btn" type="button" aria-label="선택 요소 삭제" title="삭제" onClick={remove}><Trash2 size={16} aria-hidden="true"/></button>
        </div>
      </div>}
      {showIcons&&<div className="banner-icon-picker" role="group" aria-label="배너 아이콘">
        {Object.entries(bannerIconLabels).map(([key,label])=><button type="button" key={key} disabled={full}
          onClick={()=>addIcon(key)} aria-label={label+' 아이콘 추가'}><span><BannerIcon name={key}/></span>{label}</button>)}
      </div>}
      {selected&&!isIcon&&<label>문구 내용 <small>{'\\r\\n 입력 시 줄바꿈 지원'}</small>
        <textarea aria-label="문구 내용" rows="3" maxLength={maxBannerText} value={selected.text}
          onChange={event=>update(selected.id,{text:event.target.value})}/>
      </label>}
      {selected&&<div className="banner-editor-properties">
        {isIcon&&<>
          <label>아이콘 모양<select value={selected.icon} onChange={event=>update(selected.id,{icon:event.target.value})}>
            {Object.entries(bannerIconLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}
          </select></label>
          <label>아이콘 배경<select value={selected.shape} onChange={event=>update(selected.id,{shape:event.target.value})}>
            {Object.entries(bannerIconShapes).map(([key,label])=><option key={key} value={key}>{label}</option>)}
          </select></label>
        </>}
        <label>{isIcon?'아이콘':'글자'} 색상<input type="color" value={selected.color} onChange={event=>update(selected.id,{color:event.target.value})}/></label>
        {isIcon&&selected.shape!=='plain'&&<label>배경 색상<input type="color" value={selected.background} onChange={event=>update(selected.id,{background:event.target.value})}/></label>}
        <label>{isIcon?'아이콘':'글자'} 크기 (px)<input type="number" min={isIcon?20:10} max={isIcon?160:120}
          required value={selected.size} onChange={event=>update(selected.id,{size:event.target.value})}/></label>
        <label>X 좌표 (%)<input type="number" min="0" max="100" required value={selected.x} onChange={event=>update(selected.id,{x:event.target.value})}/></label>
        <label>Y 좌표 (%)<input type="number" min="0" max="100" required value={selected.y} onChange={event=>update(selected.id,{y:event.target.value})}/></label>
        {!isIcon&&<>
          <label>문구 정렬<select value={selected.align??'left'} onChange={event=>update(selected.id,{align:event.target.value})}>
            {Object.entries(bannerTextAlignments).map(([key,label])=><option key={key} value={key}>{label}</option>)}
          </select></label>
          <label className="checkbox"><input type="checkbox" checked={selected.bold} onChange={event=>update(selected.id,{bold:event.target.checked})}/>굵게</label>
        </>}
      </div>}
    </div>
    {form.layers==null?<button className="btn" type="button" onClick={()=>onChange(defaults)}>이 배치 적용</button>:
      <button className="btn" type="button" onClick={()=>{setSelected('');onChange(null);}}>기본 배치로 복원</button>}
  </section>;
}
