import { useMemo,useState } from 'react';
import { api } from '../services/api.js';
import { useResource } from '../hooks/data.js';
import { Modal,Status } from '../components/common.jsx';
import { offerCode,offerEditLimit } from '../../../shared/offer-editor.js';
import { blankFields,EditorFields } from './Editors.jsx';
import { entities } from './fields.js';

const fields=entities.offers.fields;
const joins=fields.find(([key])=>key==='join_type')[2];
const pageSize=20;
const won=value=>Number(value).toLocaleString('ko-KR')+'원';
const editable=row=>Object.fromEntries(fields.map(([key])=>[key,row[key]]));
const compareLabels=(left,right)=>left.label.localeCompare(right.label,'ko');

function OfferRow({row,draft,disabled,update,onDelete,capacities,plans}) {
  const values=draft??row;
  const code=offerCode(row.id);
  const title=[row.product_name,row.storage,row.carrier,row.plan,row.join_type].join(' · ');
  const price=capacities.find(item=>item.id===values.capacity_id)?.price??row.price;
  const plan=plans.find(item=>item.id===values.plan_id)??row;
  return <article className={'offer-row'+(draft?' offer-row-changed':'')} aria-label={title}>
    <header className="offer-row-heading">
      <div><strong>{row.product_name} · {row.storage}</strong><p>{row.carrier} · {row.plan} · {row.join_type}</p></div>
      <div className="offer-row-tools">
        {draft&&<span className="offer-pending">수정됨</span>}
        {code===row.id?<code>{code}</code>:<details className="offer-code"><summary>{code}</summary><code>{row.id}</code></details>}
        <button className="btn" type="button" disabled={disabled} onClick={onDelete}>삭제</button>
      </div>
    </header>
    <fieldset className="offer-fields" disabled={disabled} aria-label={code+' 수정'}>
      <label>기기·용량<select required value={values.capacity_id} onChange={event=>update('capacity_id',event.target.value)}>
        {!capacities.some(item=>item.id===row.capacity_id)&&<option value={row.capacity_id}>{row.product_name} · {row.storage}</option>}
        {capacities.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
      </select><small>출고가 {won(price)}</small></label>
      <label>통신사·요금제<select required value={values.plan_id} onChange={event=>update('plan_id',event.target.value)}>
        {!plans.some(item=>item.id===row.plan_id)&&<option value={row.plan_id}>{row.carrier} · {row.plan}{row.enabled?'':' (미사용)'}</option>}
        {plans.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
      </select><small>월정액 {won(plan.fee)}</small></label>
      <label>가입 유형<select value={values.join_type} onChange={event=>update('join_type',event.target.value)}>
        {joins.map(join=><option key={join}>{join}</option>)}
      </select></label>
      <label>추가 지원금(원)<input type="number" required min="0" max={price} step="1" value={values.extra}
        onChange={event=>update('extra',event.target.value)}/></label>
      <label>공개 조회 매핑<input maxLength="160" value={values.source_key}
        onChange={event=>update('source_key',event.target.value)} placeholder="미연결"/></label>
    </fieldset>
  </article>;
}

export default function OfferEditor({refs,onChanged}) {
  const resource=useResource('/admin/offers',{keepData:true});
  const [drafts,setDrafts]=useState(()=>new Map());
  const [query,setQuery]=useState(''),[carrier,setCarrier]=useState(''),[page,setPage]=useState(0);
  const [create,setCreate]=useState(null),[remove,setRemove]=useState(null),[modalError,setModalError]=useState('');
  const [busy,setBusy]=useState(false),[result,setResult]=useState(null);
  const options=useMemo(()=>{
    const products=new Map(refs.products?.map(row=>[row.id,row.name]));
    const carriers=new Map(refs.carriers?.map(row=>[row.id,row.name]));
    return {
      capacities:(refs.capacities??[]).map(row=>({...row,label:[products.get(row.product_id),row.name].filter(Boolean).join(' · ')})).sort(compareLabels),
      plans:(refs.plans??[]).filter(row=>row.enabled).map(row=>({...row,label:[carriers.get(row.carrier_id),row.name].filter(Boolean).join(' · ')+' ('+won(row.fee)+')'})).sort(compareLabels)
    };
  },[refs]);
  const rows=resource.data??[];
  const search=query.trim().toLowerCase();
  const visible=rows.filter(row=>(!carrier||row.carrier_id===carrier)&&
    [row.product_name,row.storage,row.carrier,row.plan,row.join_type,row.source_key,row.id,offerCode(row.id)].join(' ').toLowerCase().includes(search));
  const pageCount=Math.max(1,Math.ceil(visible.length/pageSize));
  const currentPage=Math.min(page,pageCount-1);
  const pending=drafts.size;

  function update(row,key,value) {
    setResult(null);
    setDrafts(prior=>{
      const previous=prior.get(row.id);
      const before=previous?.before??editable(row);
      const after={...(previous?.after??before),[key]:value};
      const next=new Map(prior);
      if(fields.every(([field])=>String(before[field])===String(after[field])))next.delete(row.id);
      else next.set(row.id,{id:row.id,before,after});
      return next;
    });
  }

  async function save(event) {
    event.preventDefault();
    if(!pending||busy)return;
    setBusy(true);setResult(null);
    try {
      const {saved}=await api('/admin/offers',{method:'PATCH',body:{changes:[...drafts.values()]}});
      setDrafts(new Map());setResult({message:saved+'개 가격 조건을 저장했습니다.'});
      resource.retry();onChanged();
    } catch(error) {setResult({error:true,message:error.message});}
    finally {setBusy(false);}
  }

  async function saveNew(event) {
    event.preventDefault();setBusy(true);setModalError('');
    try {
      await api('/admin/offers',{method:'POST',body:create});
      setCreate(null);setResult({message:'새 가격 조건을 등록했습니다.'});
      resource.retry();onChanged();
    } catch(error) {setModalError(error.message);}
    finally {setBusy(false);}
  }

  async function deleteRow() {
    setBusy(true);setModalError('');
    try {
      await api('/admin/offers/'+encodeURIComponent(remove.id),{method:'DELETE'});
      setDrafts(prior=>{const next=new Map(prior);next.delete(remove.id);return next;});
      setRemove(null);setResult({message:'가격 조건을 삭제했습니다.'});
      resource.retry();onChanged();
    } catch(error) {setModalError(error.message);}
    finally {setBusy(false);}
  }

  return <>
    <div className="admin-head"><div><h1>가격 조건</h1><p>목록에서 조건을 수정한 뒤 변경한 항목을 한 번에 저장하세요.</p></div>
      <button className="btn" type="button" disabled={busy} onClick={()=>{setModalError('');setCreate(blankFields(fields));}}>+ 새 가격 조건</button>
    </div>
    <form className="admin-panel offer-editor" noValidate onSubmit={save}>
      <div className="filters">
        <label>가격 조건 검색<input type="search" value={query} placeholder="기기, 요금제, 가입 유형, 관리 코드" onChange={event=>{setQuery(event.target.value);setPage(0);}}/></label>
        <label>통신사 필터<select value={carrier} onChange={event=>{setCarrier(event.target.value);setPage(0);}}>
          <option value="">전체 통신사</option>{refs.carriers?.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}
        </select></label>
      </div>
      <div className="offer-save-bar">
        <span role="status">검색 결과 {visible.length}개 · 미저장 {pending}개</span>
        <div className="actions">
          <button className="btn" type="button" disabled={!pending||busy} onClick={()=>{setDrafts(new Map());setResult(null);resource.retry();}}>변경 취소</button>
          <button className="btn primary" type="submit" disabled={!pending||busy||resource.loading}>{busy?'처리 중…':'변경사항 저장'}</button>
        </div>
      </div>
      {pending===offerEditLimit&&<p className="message">한 번에 최대 {offerEditLimit}개를 저장할 수 있습니다. 현재 변경사항을 먼저 저장하세요.</p>}
      {result&&<p role={result.error?'alert':'status'} className={'message '+(result.error?'error':'')}>{result.message}</p>}
      <Status resource={resource}/>
      {resource.data&&!visible.length&&<p className="message">조건에 맞는 항목이 없습니다.</p>}
      <div className="offer-list">
        {visible.slice(currentPage*pageSize,(currentPage+1)*pageSize).map(row=><OfferRow key={row.id} row={row} draft={drafts.get(row.id)?.after}
          disabled={busy||(!drafts.has(row.id)&&pending===offerEditLimit)} update={(key,value)=>update(row,key,value)}
          onDelete={()=>{setModalError('');setRemove(row);}} {...options}/>)}
      </div>
      {pageCount>1&&<nav className="actions offer-pages" aria-label="가격 조건 페이지">
        <button className="btn" type="button" disabled={!currentPage} onClick={()=>setPage(currentPage-1)}>이전</button>
        <span>{currentPage+1} / {pageCount}</span>
        <button className="btn" type="button" disabled={currentPage+1>=pageCount} onClick={()=>setPage(currentPage+1)}>다음</button>
      </nav>}
    </form>
    {create&&<Modal title="새 가격 조건" onClose={()=>{if(!busy)setCreate(null);}}>
      <form className="form-stack" onSubmit={saveNew}>
        <EditorFields fields={fields} form={create} setForm={setCreate} refs={{...refs,plans:options.plans}}/>
        {modalError&&<p className="message error" role="alert">{modalError}</p>}
        <button className="btn primary" disabled={busy}>등록</button>
      </form>
    </Modal>}
    {remove&&<Modal title="가격 조건 삭제" onClose={()=>{if(!busy)setRemove(null);}}>
      <p>{remove.product_name} · {remove.storage} · {remove.carrier} · {remove.plan} · {remove.join_type}</p>
      <p>이 조건과 연결된 공통지원금 기록도 삭제됩니다.</p>
      {modalError&&<p className="message error" role="alert">{modalError}</p>}
      <button className="btn danger" disabled={busy} onClick={deleteRow}>삭제 확인</button>
    </Modal>}
  </>;
}
