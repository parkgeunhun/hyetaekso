import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { appearanceSlots, heroAppearance } from '../../../shared/site-appearance.js';
import { api } from '../services/api.js';
import { useResource } from '../hooks/data.js';
import { Art, Modal, Status } from '../components/common.jsx';
import { EditorFields } from './Editors.jsx';
import BannerTextEditor from './BannerTextEditor.jsx';
import CopyCode from './CopyCode.jsx';

const slotTitle=(slot,values)=>values?.title?.trim()||slot.label;

function readDraft(key) {
  try {
    const draft=JSON.parse(sessionStorage.getItem(key));
    return draft?.form&&typeof draft.form==='object'&&!Array.isArray(draft.form)?draft:null;
  } catch {return null;}
}

function initialForm(slot, values) {
  return {
    ...Object.fromEntries((slot.fields ?? []).map(([key, , fallback]) => [key, fallback ?? ''])),
    ...values,
    image: values?.image || values?.mobile || '',
    ...(slot.mobile ? {mobile: ''} : {})
  };
}

function SlotEditor({slot, saved, onChanged}) {
  const draftKey='hyetaekso-appearance-draft:v1:'+slot.key;
  const [draft]=useState(()=>readDraft(draftKey));
  const [baseline,setBaseline]=useState(()=>initialForm(slot,saved));
  const [form, setForm] = useState(() => draft?.form??baseline);
  const [restored,setRestored]=useState(Boolean(draft));
  const [draftSaved,setDraftSaved]=useState(false);
  const [confirmReset,setConfirmReset]=useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const dirty=JSON.stringify(form)!==JSON.stringify(baseline);
  const mediaFields = slot.textOnly ? [] : [['image', slot.hero ? '배너 이미지' : '이미지', 'picture']];
  const otherFields = slot.hero ? [] : (slot.fields ?? [])
    .map(([key, label]) => [key, label, key === 'description' ? 'area' : 'text']);
  const mediaCategory=slot.path==='/mobility'?'car':slot.hero?'banner':'other';

  useEffect(()=>{
    try {
      if(dirty)sessionStorage.setItem(draftKey,JSON.stringify({base:JSON.stringify(baseline),form}));
      else sessionStorage.removeItem(draftKey);
      setDraftSaved(true);
    } catch {setDraftSaved(false);}
  },[draftKey,baseline,form,dirty]);
  useEffect(()=>{
    if(!dirty||draftSaved)return;
    const warn=event=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',warn);
    return ()=>window.removeEventListener('beforeunload',warn);
  },[dirty,draftSaved]);

  function edit(update) {
    setForm(update);
    setResult(null);
  }

  function discard() {
    setForm(baseline);
    setRestored(false);
    setResult({message:'마지막으로 저장한 설정을 불러왔습니다.'});
  }

  async function apply(event, reset = false) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const values = await api('/admin/appearance/' + slot.key, reset ? {method: 'DELETE'} : {method: 'PUT', body: form});
      const next=initialForm(slot,reset?undefined:values);
      setForm(next);
      setBaseline(next);
      setRestored(false);
      setResult({message: reset ? '기본 이미지와 문구를 복원했습니다.' : '공개 화면에 반영했습니다.'});
      onChanged();
    } catch (error) {
      setResult({error: true, message: error.message});
    } finally {
      setBusy(false);
    }
  }

  return <><form className="admin-panel form-stack" onSubmit={apply}>
    <fieldset className="editor-fieldset" disabled={busy}>
      <legend>{slotTitle(slot,saved)}</legend>
      {!slot.hero&&!slot.textOnly&&!form.image&&<div className="appearance-preview">
        <small>기본 이미지</small>
        {slot.image ? <img src={slot.image} alt="기본 이미지"/> : <Art tile={slot.tile}/>}
      </div>}
      <EditorFields fields={mediaFields} form={form} setForm={edit} mediaCategory={mediaCategory}/>
      {slot.hero&&<BannerTextEditor hero={heroAppearance(slot.hero,form)} form={form} home={slot.key==='home-hero'}
        onChange={layers=>edit(current=>({...current,layers}))}/>}
      {otherFields.length>0&&<EditorFields fields={otherFields} form={form} setForm={edit}/>}
      {dirty&&<p className="message" role="status">{restored?'이 탭에 임시 보관한 편집 내용을 복원했습니다. ':''}
        {draftSaved?'미저장 변경 내용은 이 탭에 임시 보관됩니다. 탭을 닫기 전에 저장해 주세요.':'임시 보관을 사용할 수 없습니다. 화면을 이동하기 전에 저장해 주세요.'}
        {' '}공개 화면에는 저장 후 반영됩니다.
        {restored&&draft.base!==JSON.stringify(baseline)&&' 서버의 저장 내용도 변경되어 있습니다. 저장 전 공개 화면과 비교해 주세요.'}
      </p>}
      <div className="actions">
        <button className="btn primary" type="submit">{busy ? '처리 중…' : '화면 설정 저장'}</button>
        <button className="btn" type="button" disabled={!dirty} onClick={discard}>미저장 변경 취소</button>
        <button className="btn" type="button" onClick={()=>setConfirmReset(true)}>기본값 복원</button>
      </div>
    </fieldset>
    {result&&<p role={result.error?'alert':'status'} className={'message '+(result.error?'error':'')}>{result.message}</p>}
  </form>
    {confirmReset&&<Modal title="기본값으로 복원할까요?" onClose={()=>setConfirmReset(false)}>
      <p>{slotTitle(slot,saved)}의 이미지와 문구를 기본 설정으로 바꿉니다. 현재 편집 내용과 저장된 설정이 기본값으로 교체되고 공개 화면에도 바로 반영됩니다.</p>
      <div className="actions"><button type="button" className="btn" onClick={()=>setConfirmReset(false)}>취소</button>
        <button type="button" className="btn primary" onClick={event=>{setConfirmReset(false);apply(event,true);}}>기본값으로 복원</button></div>
    </Modal>}
  </>;
}

export default function AppearanceEditor({onChanged, page}) {
  const resource = useResource('/admin/appearance', {keepData: true});
  const [key, setKey] = useState('');
  const isCommon = page === '공통';
  const slots = appearanceSlots.filter(slot => slot.group === page);
  const slot = slots.find(item => item.key === key) ?? slots[0];

  return <>
    <div className="admin-head">
      <div><h1>{isCommon ? '로고·탭 아이콘' : page+' 화면 편집'}</h1><p>{isCommon ? '사이트 전체에 표시되는 로고와 브라우저 탭 아이콘을 변경합니다.' : '이 페이지의 사진과 배너 문구를 편집합니다.'}</p></div>
      <div className="actions">
        {!isCommon&&page!=='홈'&&<Link className="btn" to={'/admin/service-'+slot.path.slice(1)}>추가 안내 관리</Link>}
        <Link className="btn" to={slot.path} target="_blank" rel="noopener">공개 화면 열기</Link>
      </div>
    </div>
    <div className="admin-panel filters">
      <label>편집할 위치<select aria-label="편집할 위치" value={slot.key} onChange={e=>setKey(e.target.value)}>
        {slots.map(item=><option key={item.key} value={item.key}>{slotTitle(item,resource.data?.[item.key])}</option>)}
      </select></label>
      <CopyCode code={slot.key} label={slotTitle(slot,resource.data?.[slot.key])}/>
    </div>
    {slot.key==='home-hero'&&<p className="message">기본 홈 배너는 활성 슬라이드가 없을 때 표시됩니다. 슬라이드 사진과 문구는 <Link to="/admin/banners">홈 배너 슬라이드</Link>에서 수정하세요.</p>}
    <Status resource={resource}/>
    {resource.data&&<SlotEditor key={slot.key} slot={slot} saved={resource.data[slot.key]} onChanged={()=>{resource.retry();onChanged();}}/>}
  </>;
}
