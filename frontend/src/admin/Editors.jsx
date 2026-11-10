import { useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useResource } from '../hooks/data.js';
import { Modal,Status } from '../components/common.jsx';
import { entities,recordTitle,settingsFields,optionLabels } from './fields.js';
import { boardTitles } from '../pages/content.js';
import { isVideoUrl } from '../../../shared/media-library.js';
import { MediaPicker } from './ImageLibrary.jsx';
import BannerTextEditor from './BannerTextEditor.jsx';

function MediaField({label,value,update,type,category}) {
  const [picker,setPicker]=useState(false);
  return <div className="media-field"><strong>{label}</strong>
    <button type="button" className="btn" aria-label={label+' 보관함에서 선택'} onClick={()=>setPicker(true)}>보관함에서 선택</button>
    {value&&<div className="media-preview">{isVideoUrl(value)?<video controls preload="metadata" src={value}/>:<img src={value} alt={label+' 미리보기'}/>}<button type="button" className="btn" onClick={()=>update('')}>선택 해제</button></div>}
    {picker&&<MediaPicker type={type} category={category} onClose={()=>setPicker(false)} onSelect={url=>{update(url);setPicker(false);}}/>}
  </div>;
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
export function EditorFields({fields,form,setForm,refs={},mediaCategory='other'}) {
  return fields.map(([key,label,type])=>{
    const value=form[key],update=value=>setForm(prior=>({...prior,[key]:value}));
    if(type==='check')return <label key={key} className="checkbox"><input type="checkbox" checked={Boolean(value)} onChange={e=>update(+e.target.checked)}/>{label}</label>;
    if(type==='area')return <label key={key}>{label}<textarea rows="4" value={value??''} onChange={e=>update(e.target.value)}/></label>;
    if(['media','picture','video'].includes(type))return <MediaField key={key} label={label} value={value} update={update} type={type} category={mediaCategory}/>;
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
export function blankFields(fields) {return Object.fromEntries(fields.map(([key,,type])=>[key,Array.isArray(type)?type[0]:type==='check'||type==='number'?0:type==='multiple'?[]:'']));}

function recordFields(entity, fields, form) {
  if(entity!=='banners')return fields;
  return fields.flatMap(field=>{
    const [key,label]=field;
    if(key==='image')return [[key,form.kind==='video'?'배너 영상':label,form.kind==='video'?'video':'picture']];
    if(form.kind==='video'&&['alt','link'].includes(key))return [];
    return [field];
  });
}
export function Records({entity,refs,onChanged,kind,category,general,title:customTitle}) {
  const definition=entities[entity];
  const queryString=kind?'?'+new URLSearchParams({kind,...(category?{category}:{}),...(general?{scope:'general'}:{})}):'';
  const resource=useResource('/admin/'+entity+queryString);
  const title=customTitle??(kind?boardTitles[kind]:definition.title);
  const fields=definition.fields.filter(([key])=>!(kind&&key==='kind')&&!(category&&key==='category'));
  const mediaCategory=entity==='banners'?'banner':['products','colors'].includes(entity)?'phone':category==='service:mobility'?'car':'other';
  const [form,setForm]=useState(null),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[remove,setRemove]=useState(null);
  const records=resource.data?.filter(item=>Object.values(item).some(value=>String(value).toLowerCase().includes(query.toLowerCase())))||[];
  async function save(event) {
    event.preventDefault();
    if(general&&form.category?.trim().toLowerCase().startsWith('service:')) {
      setError('서비스별 추가 안내는 해당 서비스 메뉴에서 등록해 주세요.');return;
    }
    setBusy(true);setError('');
    try {
      const body={...form,...(entity==='banners'?{mobile:''}:{}),...(kind?{kind}:{}),...(category?{category}:{})};
      await api('/admin/'+entity+(form.id?'/'+form.id:''),{method:form.id?'PUT':'POST',body});
      setForm(null);resource.retry();onChanged();
    }
    catch(error){setError(error.message);}finally{setBusy(false);}
  }
  async function deleteItem() {
    setBusy(true);setError('');
    try {await api('/admin/'+entity+'/'+remove.id,{method:'DELETE'});setRemove(null);resource.retry();onChanged();}
    catch(error){setError(error.message);}finally{setBusy(false);}
  }
  return <><div className="admin-head"><div><h1>{title}</h1><p>등록된 항목을 검색하고 변경할 수 있습니다.</p></div>{entity==='products'?<Link className="btn primary" to="/admin/phone-registration">휴대폰 등록</Link>:<button className="btn primary" onClick={()=>{setError('');setForm(blankFields(fields));}}>+ 새 항목</button>}</div>
    <div className="admin-panel"><label>목록 검색<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label><Status resource={resource}/>
      <div className="table-scroll"><table><thead><tr><th>항목</th><th>관리 코드</th><th>관리</th></tr></thead><tbody>{records.map(item=><tr key={item.id}><td>{recordTitle(item)}</td><td>{item.id}</td><td>{item.mode==='feed'?<span>자동 갱신</span>:<><button className="btn" onClick={()=>{setError('');setForm(entity==='banners'&&item.kind!=='video'?{...item,image:item.image||item.mobile}:item);}}>수정</button> <button className="btn" onClick={()=>{setError('');setRemove(item);}}>삭제</button></>}</td></tr>)}</tbody></table></div>{resource.data&&!records.length&&<p className="message">항목이 없습니다.</p>}</div>
    {form&&<Modal title={title+(form.id?' 수정':' 등록')} className={entity==='banners'?'banner-editor-dialog':''} onClose={()=>{if(!busy)setForm(null);}}><form className="form-stack" onSubmit={save}><EditorFields fields={recordFields(entity,fields,form)} form={form} setForm={setForm} refs={refs} mediaCategory={mediaCategory}/>
      {entity==='banners'&&Boolean(form.intro)&&<BannerTextEditor form={form} onChange={layers=>setForm(current=>({...current,layers}))}/>}
      {error&&<p role="alert" className="message error">{error}</p>}<button className="btn primary" disabled={busy}>저장</button></form></Modal>}
    {remove&&<Modal title="항목 삭제" onClose={()=>{if(!busy)setRemove(null);}}><p>{recordTitle(remove)} 항목을 삭제합니다.</p>{error&&<p role="alert" className="message error">{error}</p>}<button className="btn danger" onClick={deleteItem} disabled={busy}>삭제</button></Modal>}
  </>;
}
export function SiteSettings({only,title,subsection,onChanged}) {
  const resource=useResource('/admin/settings'),[form,setForm]=useState(null),[result,setResult]=useState(null),[busy,setBusy]=useState(false);
  const fields=settingsFields.filter(([key])=>only.includes(key));
  const Heading=subsection?'h2':'h1';
  useEffect(()=>{if(resource.data)setForm(resource.data);},[resource.data]);
  async function save(event) {
    event.preventDefault();setBusy(true);setResult(null);
    try {
      const body=Object.fromEntries(fields.map(([key])=>[key,form[key]]));
      setForm(await api('/admin/settings',{method:'PUT',body}));
      setResult({message:'설정을 저장했습니다.'});
      onChanged?.();
    }
    catch(error){setResult({message:error.message,error:true});}finally{setBusy(false);}
  }
  return <><Heading>{title}</Heading><Status resource={resource}/>{form&&<form className="admin-panel form-stack settings-grid" onSubmit={save}><EditorFields fields={fields} form={form} setForm={setForm}/>{result&&<p role={result.error?'alert':'status'} className={'message '+(result.error?'error':'')}>{result.message}</p>}<button className="btn primary" disabled={busy}>설정 저장</button></form>}</>;
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
