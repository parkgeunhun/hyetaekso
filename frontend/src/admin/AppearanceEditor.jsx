import { useState } from 'react';
import { Link } from 'react-router-dom';
import { appearanceSlots } from '../../../shared/site-appearance.js';
import { api } from '../services/api.js';
import { useResource } from '../hooks/data.js';
import { Art, Status } from '../components/common.jsx';
import { EditorFields, mediaUploading } from './Editors.jsx';

const groups = [...new Set(appearanceSlots.map(slot => slot.group))];

function initialForm(slot, values) {
  return {
    image: '',
    ...(slot.mobile ? {mobile: ''} : {}),
    ...Object.fromEntries((slot.fields ?? []).map(([key, , fallback]) => [key, fallback ?? ''])),
    ...values
  };
}

function SlotEditor({slot, saved, onChanged}) {
  const [form, setForm] = useState(() => initialForm(slot, saved));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const fields = [
    ['image', slot.mobile ? 'PC 사진' : '이미지', 'picture'],
    ...(slot.mobile ? [['mobile', '모바일 사진 (선택)', 'picture']] : []),
    ...(slot.fields ?? []).map(([key, label]) => [key, label, key === 'description' ? 'area' : 'text'])
  ];

  async function apply(event, reset = false) {
    event.preventDefault();
    if (mediaUploading(event.currentTarget.form ?? event.currentTarget)) {
      setResult({error: true, message: '파일 업로드가 끝난 후 저장해 주세요.'});
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const values = await api('/admin/appearance/' + slot.key, reset ? {method: 'DELETE'} : {method: 'PUT', body: form});
      setForm(initialForm(slot, reset ? undefined : values));
      setResult({message: reset ? '기본 이미지와 문구를 복원했습니다.' : '공개 화면에 반영했습니다.'});
      onChanged();
    } catch (error) {
      setResult({error: true, message: error.message});
    } finally {
      setBusy(false);
    }
  }

  return <form className="admin-panel form-stack" onSubmit={apply}>
    <fieldset className="editor-fieldset" disabled={busy}>
      <legend>{slot.label}</legend>
      {!form.image&&<div className="appearance-preview">
        <small>기본 이미지</small>
        {slot.image ? <img src={slot.image} alt="기본 이미지"/> : <Art tile={slot.tile}/>}
      </div>}
      <EditorFields fields={fields} form={form} setForm={setForm}/>
      <div className="actions">
        <button className="btn primary" type="submit">{busy ? '처리 중…' : '화면 설정 저장'}</button>
        <button className="btn" type="button" onClick={event=>apply(event, true)}>기본값 복원</button>
      </div>
    </fieldset>
    {result&&<p role={result.error?'alert':'status'} className={'message '+(result.error?'error':'')}>{result.message}</p>}
  </form>;
}

export default function AppearanceEditor({onChanged}) {
  const resource = useResource('/admin/appearance', {keepData: true});
  const [group, setGroup] = useState('홈');
  const [key, setKey] = useState('home-hero');
  const slots = appearanceSlots.filter(slot => slot.group === group);
  const slot = slots.find(item => item.key === key) ?? slots[0];

  return <>
    <div className="admin-head">
      <div><h1>사이트 이미지·배너 편집</h1><p>공개 화면의 사진과 상단 배너 문구를 위치별로 저장합니다.</p></div>
      <Link className="btn" to={slot.path} target="_blank" rel="noopener">공개 화면 열기</Link>
    </div>
    <div className="admin-panel filters">
      <label>편집할 화면<select aria-label="편집할 화면" value={group} onChange={e=>setGroup(e.target.value)}>
        {groups.map(name=><option key={name}>{name}</option>)}
      </select></label>
      <label>편집할 위치<select aria-label="편집할 위치" value={slot.key} onChange={e=>setKey(e.target.value)}>
        {slots.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}
      </select></label>
    </div>
    {slot.key==='home-hero'&&<p className="message">기본 홈 배너는 활성 슬라이드가 없을 때 표시됩니다. 슬라이드 사진과 문구는 <Link to="/admin/banners">홈 배너 슬라이드</Link>에서 수정하세요.</p>}
    <Status resource={resource}/>
    {resource.data&&<SlotEditor key={slot.key} slot={slot} saved={resource.data[slot.key]} onChanged={()=>{resource.retry();onChanged();}}/>}
  </>;
}
