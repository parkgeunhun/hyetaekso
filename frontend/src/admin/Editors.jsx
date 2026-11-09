import { useEffect,useState } from 'react';
import { api } from '../services/api.js';
import { useResource } from '../hooks/data.js';
import { Modal,Status } from '../components/common.jsx';
import { entities,recordTitle,settingsFields,optionLabels } from './fields.js';

function MediaField({label,value,update}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function upload(event) {
    const file=event.target.files[0];if(!file)return;
    setBusy(true);setError('');
    try {const result=await api('/admin/media',{method:'POST',body:file,raw:true});update(result.url);}
    catch(error){setError(error.message);}finally{setBusy(false);event.target.value='';}
  }
  return <div className="media-field"><label>{label}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" onChange={upload} disabled={busy}/></label>
    {busy&&<p role="status">업로드 중…</p>}{value&&<div className="media-preview">{/\.(mp4|webm)(\?|$)/i.test(value)?<video controls preload="metadata" src={value}/>:<img src={value} alt={label+' 미리보기'}/>}<button type="button" className="btn" onClick={()=>update('')}>선택 해제</button></div>}
    {error&&<p role="alert" className="message error">{error}</p>}</div>;
}
function ReferenceField({label,entity,value,update,refs}) {
  const records=refs[entity]||[];
  return <label>{label}<select value={value??''} onChange={e=>update(e.target.value)} required><option value="">선택</option>{records.map(row=>{
    const related=entity==='capacities'?refs.products?.find(p=>p.id===row.product_id)?.name:entity==='plans'?refs.carriers?.find(c=>c.id===row.carrier_id)?.name:null;
    const cap=entity==='offers'?refs.capacities?.find(c=>c.id===row.capacity_id):null;
    const offerLabel=cap?[refs.products?.find(p=>p.id===cap.product_id)?.name,cap.name,refs.plans?.find(p=>p.id===row.plan_id)?.name,row.join_type].filter(Boolean).join(' · '):null;
    return <option key={row.id} value={row.id}>{offerLabel||[related,recordTitle(row)].filter(Boolean).join(' · ')}</option>;
  })}</select></label>;
}
export function EditorFields({fields,form,setForm,refs={}}) {
  return fields.map(([key,label,type])=>{
    const value=form[key],update=value=>setForm(prior=>({...prior,[key]:value}));
    if(type==='check')return <label key={key} className="checkbox"><input type="checkbox" checked={Boolean(value)} onChange={e=>update(+e.target.checked)}/>{label}</label>;
    if(type==='area')return <label key={key}>{label}<textarea rows="4" value={value??''} onChange={e=>update(e.target.value)}/></label>;
    if(type==='media')return <MediaField key={key} label={label} value={value} update={update}/>;
    if(type==='multiple')return <fieldset key={key}><legend>{label}</legend>{refs.categories?.map(category=><label className="checkbox" key={category.id}><input type="checkbox" checked={(value||[]).includes(category.id)} onChange={e=>update(e.target.checked?[...(value||[]),category.id]:(value||[]).filter(id=>id!==category.id))}/>{category.name}</label>)}</fieldset>;
    if(Array.isArray(type))return <label key={key}>{label}<select value={value??type[0]} onChange={e=>update(e.target.value)}>{type.map(option=><option key={option} value={option}>{optionLabels[option]||option}</option>)}</select></label>;
    if(type in entities)return <ReferenceField key={key} label={label} entity={type} value={value} update={update} refs={refs}/>;
    if(type==='date') {
      const local=value?new Date(Number(value)-new Date(Number(value)).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
      return <label key={key}>{label}<input type="datetime-local" required value={local} onChange={e=>update(e.target.value?new Date(e.target.value).getTime():0)}/></label>;
    }
    return <label key={key}>{label}<input type={type==='number'?'number':'text'} value={value??''} min={type==='number'?0:undefined} onChange={e=>update(e.target.value)}/></label>;
  });
}
function blank(fields) {return Object.fromEntries(fields.map(([key,,type])=>[key,Array.isArray(type)?type[0]:type==='check'||type==='number'?0:type==='multiple'?[]:'']));}
export function Records({entity,refs,onChanged}) {
  const definition=entities[entity],resource=useResource('/admin/'+entity);
  const [form,setForm]=useState(null),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[remove,setRemove]=useState(null);
  const records=resource.data?.filter(item=>Object.values(item).some(value=>String(value).toLowerCase().includes(query.toLowerCase())))||[];
  async function save(event) {
    event.preventDefault();setBusy(true);setError('');
    try {await api('/admin/'+entity+(form.id?'/'+form.id:''),{method:form.id?'PUT':'POST',body:form});setForm(null);resource.retry();onChanged();}
    catch(error){setError(error.message);}finally{setBusy(false);}
  }
  async function deleteItem() {
    setBusy(true);setError('');
    try {await api('/admin/'+entity+'/'+remove.id,{method:'DELETE'});setRemove(null);resource.retry();onChanged();}
    catch(error){setError(error.message);}finally{setBusy(false);}
  }
  return <><div className="admin-head"><div><h1>{definition.title}</h1><p>등록된 항목을 검색하고 변경할 수 있습니다.</p></div><button className="btn primary" onClick={()=>{setError('');setForm(blank(definition.fields));}}>+ 새 항목</button></div>
    <div className="admin-panel"><label>목록 검색<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label><Status resource={resource}/>
      <div className="table-scroll"><table><thead><tr><th>항목</th><th>관리 코드</th><th>관리</th></tr></thead><tbody>{records.map(item=><tr key={item.id}><td>{recordTitle(item)}{item.mode==='feed'?' · 자동 갱신':''}</td><td>{item.id}</td><td><button className="btn" onClick={()=>{setError('');setForm(item);}} disabled={item.mode==='feed'}>수정</button> <button className="btn" onClick={()=>{setError('');setRemove(item);}} disabled={item.mode==='feed'}>삭제</button></td></tr>)}</tbody></table></div>{resource.data&&!records.length&&<p className="message">항목이 없습니다.</p>}</div>
    {form&&<Modal title={definition.title+(form.id?' 수정':' 등록')} onClose={()=>{if(!busy)setForm(null);}}><form className="form-stack" onSubmit={save}><EditorFields fields={definition.fields} form={form} setForm={setForm} refs={refs}/>{error&&<p role="alert" className="message error">{error}</p>}<button className="btn primary" disabled={busy}>저장</button></form></Modal>}
    {remove&&<Modal title="항목 삭제" onClose={()=>{if(!busy)setRemove(null);}}><p>{recordTitle(remove)} 항목을 삭제합니다.</p>{error&&<p role="alert" className="message error">{error}</p>}<button className="btn danger" onClick={deleteItem} disabled={busy}>삭제</button></Modal>}
  </>;
}
export function SiteSettings() {
  const resource=useResource('/admin/settings'),[form,setForm]=useState(null),[result,setResult]=useState(null),[busy,setBusy]=useState(false);
  useEffect(()=>{if(resource.data)setForm(resource.data);},[resource.data]);
  async function save(event) {
    event.preventDefault();setBusy(true);setResult(null);
    try {setForm(await api('/admin/settings',{method:'PUT',body:form}));setResult({message:'설정을 저장했습니다.'});}
    catch(error){setResult({message:error.message,error:true});}finally{setBusy(false);}
  }
  return <><h1>사이트 설정</h1><Status resource={resource}/>{form&&<form className="admin-panel form-stack settings-grid" onSubmit={save}><EditorFields fields={settingsFields} form={form} setForm={setForm}/>{result&&<p role={result.error?'alert':'status'} className={'message '+(result.error?'error':'')}>{result.message}</p>}<button className="btn primary" disabled={busy}>설정 저장</button></form>}</>;
}
function toBase64(file) {
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('파일을 읽지 못했습니다.'));reader.readAsDataURL(file);});
}
export function Excel() {
  const [entity,setEntity]=useState('products'),[file,setFile]=useState(null),[preview,setPreview]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function run(apply) {
    setBusy(true);setMessage('');
    try {
      if(file.size>4*1024*1024)throw new Error('최대 4MB의 XLSX 파일을 선택하세요.');
      const result=await api('/admin/excel/'+entity,{method:'POST',body:{file:await toBase64(file),apply,fingerprint:preview?.fingerprint}});
      setPreview(apply?null:result);setMessage(result.rows+'개 행 '+(apply?'저장 완료':'검증 완료. 적용하면 저장됩니다.'));
    } catch(error){setMessage(error.message);setPreview(null);}finally{setBusy(false);}
  }
  return <><h1>엑셀 가져오기·내보내기</h1><section className="admin-panel form-stack"><p>양식을 다운로드한 뒤 필요한 행을 편집하세요. 관리 코드가 있는 행은 해당 항목을 업데이트합니다.</p>
    <label>엑셀 종류<select value={entity} disabled={busy} onChange={e=>{setEntity(e.target.value);setPreview(null);}}>{Object.entries(entities).map(([key,value])=><option key={key} value={key}>{value.title}</option>)}</select></label>
    <a className="btn" href={'/api/admin/excel/'+entity}>XLSX 다운로드</a>
    <label>가져올 파일<input type="file" accept=".xlsx" disabled={busy} onChange={e=>{setFile(e.target.files[0]||null);setPreview(null);}}/></label>
    <div className="actions"><button className="btn" disabled={!file||busy} onClick={()=>run(false)}>변경 미리보기</button>{preview&&<button className="btn primary" disabled={busy} onClick={()=>run(true)}>검증한 변경 적용</button>}</div>{message&&<p role="status">{message}</p>}
  </section></>;
}
