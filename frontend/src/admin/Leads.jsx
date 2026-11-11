import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Modal, Status } from '../components/common.jsx';
import { useResource } from '../hooks/data.js';
import { serviceTypes } from '../pages/content.js';
import { api } from '../services/api.js';
import { leadStates } from './fields.js';

const formatTime = value => new Date(Number(value)).toLocaleString('ko-KR');

function ManualLeadForm({onClose,onCreated}) {
  const requestKey=useRef(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');

  async function save(event) {
    event.preventDefault();
    setBusy(true);setError('');
    requestKey.current??=crypto.randomUUID();
    const fields=Object.fromEntries(new FormData(event.currentTarget));
    try {
      const lead=await api('/admin/leads',{method:'POST',body:{...fields,requestKey:requestKey.current}});
      onCreated(lead);
    } catch(error) {setError(error.message);}
    finally {setBusy(false);}
  }

  return <Modal title="상담 수동 등록" onClose={()=>{if(!busy)onClose();}}>
    <form className="form-stack" onSubmit={save}>
      <label>상담 유형<select name="service" defaultValue="" required>
        <option value="" disabled>유형 선택</option>
        {serviceTypes.map(service=><option key={service}>{service}</option>)}
      </select></label>
      <label>이름<input name="name" required maxLength={80}/></label>
      <label>휴대폰 번호<input name="phone" type="tel" required maxLength={20}/></label>
      <label>진행 상태<select name="status">{leadStates.map(state=><option key={state}>{state}</option>)}</select></label>
      <label>상담 내용<textarea name="details" rows={4} maxLength={3000}/></label>
      {error&&<p className="message error" role="alert">{error}</p>}
      <button className="btn primary" disabled={busy}>{busy?'등록 중…':'등록'}</button>
    </form>
  </Modal>;
}

function LeadDetails({id,onClose,onSaved}) {
  const detail=useResource('/admin/leads/'+encodeURIComponent(id));
  const [busy,setBusy]=useState(false),[result,setResult]=useState(null);
  const row=detail.data,consent=row?JSON.parse(row.consent):null;

  async function save(event) {
    event.preventDefault();
    setBusy(true);setResult(null);
    const fields=Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api('/admin/leads/'+encodeURIComponent(id),{method:'PATCH',body:fields});
      onSaved();
      setResult({message:'상담 상태를 저장했습니다.'});
    } catch(error) {setResult({error:true,message:error.message});}
    finally {setBusy(false);}
  }

  return <Modal title="상담 상세" onClose={()=>{if(!busy)onClose();}}>
    <Status resource={detail}/>
    {row&&<form className="form-stack" onSubmit={save}>
      <p>{row.receipt} · {row.service}</p>
      <p>{[row.name,row.phone,row.birth].filter(Boolean).join(' · ')}</p>
      <p className="preserve">{row.details}</p>
      {consent?.source==='manual'?<p>수동 등록 · {consent.registeredBy}</p>:<details>
        <summary>신청 당시 견적·동의 기록</summary>
        <pre>{JSON.stringify({quote:JSON.parse(row.quote),consent},null,2)}</pre>
      </details>}
      <label>진행 상태<select name="status" defaultValue={row.status}>{leadStates.map(state=><option key={state}>{state}</option>)}</select></label>
      <label>관리 메모<textarea name="notes" rows={4} defaultValue={row.notes}/></label>
      <button className="btn primary" disabled={busy}>저장</button>
      {result&&<p className={'message'+(result.error?' error':'')} role={result.error?'alert':'status'}>{result.message}</p>}
    </form>}
  </Modal>;
}

export default function Leads() {
  const [params,setParams]=useSearchParams();
  const appliedQuery=params.get('q')||'';
  const filterKey=params.toString();
  const page=Math.max(0,Number.parseInt(params.get('page')??'0',10)||0);
  const [query,setQuery]=useState(appliedQuery),[detailId,setDetailId]=useState('');
  const [adding,setAdding]=useState(false),[selection,setSelection]=useState([]);
  const [deleting,setDeleting]=useState(false),[deleteIds,setDeleteIds]=useState([]);
  const [deleteError,setDeleteError]=useState(''),[message,setMessage]=useState('');
  const selectAll=useRef(null);
  const resource=useResource('/admin/leads?'+filterKey);
  const items=resource.data?.items??[];
  const selectedIds=items.filter(item=>selection.includes(item.id)).map(item=>item.id);
  const allSelected=items.length>0&&selectedIds.length===items.length;

  useEffect(()=>setQuery(appliedQuery),[appliedQuery]);
  useEffect(()=>setSelection([]),[filterKey]);
  useEffect(()=>{
    if(selectAll.current)selectAll.current.indeterminate=selectedIds.length>0&&!allSelected;
  },[selectedIds.length,allSelected]);

  function filter(values) {
    const next={...Object.fromEntries(params),page:'',...values};
    setParams(Object.fromEntries(Object.entries(next).filter(([,value])=>value)));
  }

  function onCreated(lead) {
    setAdding(false);
    setQuery('');setSelection([]);setParams({});
    setMessage('상담을 등록했습니다. 신청번호 '+lead.receipt);
    resource.retry();
  }

  async function deleteSelected() {
    setDeleting(true);setDeleteError('');
    try {
      const {deleted}=await api('/admin/leads',{method:'DELETE',body:{ids:deleteIds}});
      setDeleteIds([]);setSelection([]);
      setMessage(deleted?deleted+'건의 상담을 삭제했습니다.':'선택한 상담이 이미 목록에서 삭제되었습니다.');
      if(page>0&&!resource.data?.more&&deleteIds.length===items.length)filter({page:String(page-1)});
      else resource.retry();
    } catch(error) {setDeleteError(error.message);}
    finally {setDeleting(false);}
  }

  return <>
    <div className="admin-head">
      <h1>상담 접수</h1>
      <div className="actions">
        <Link className="btn" to="/admin/intake-settings">상담 접수 설정</Link>
        <button className="btn primary" type="button" onClick={()=>setAdding(true)}>상담 수동 등록</button>
      </div>
    </div>
    <section className="admin-panel">
      <form className="filters" onSubmit={event=>{event.preventDefault();filter({q:query.trim()});}}>
        <label>상담 유형<select value={params.get('service')||''} onChange={event=>filter({service:event.target.value})}>
          <option value="">전체 유형</option>{serviceTypes.map(service=><option key={service}>{service}</option>)}
        </select></label>
        <label>상태<select value={params.get('status')||''} onChange={event=>filter({status:event.target.value})}>
          <option value="">전체 상태</option>{leadStates.map(state=><option key={state}>{state}</option>)}
        </select></label>
        <label>신청번호·이름·전화<input type="search" value={query} onChange={event=>setQuery(event.target.value)}/></label>
        <button className="btn">검색</button>
        <button className="btn" type="button" onClick={()=>{setQuery('');setParams({});}}>초기화</button>
      </form>
      {params.get('overdue')==='1'&&<p className="message">접수 후 24시간이 지난 상담만 표시합니다.</p>}
      <div className="actions">
        <button className="btn danger" type="button" disabled={!selectedIds.length}
          onClick={()=>{setDeleteError('');setDeleteIds(selectedIds);}}>
          선택 삭제{selectedIds.length?' ('+selectedIds.length+')':''}
        </button>
      </div>
      {message&&<p className="message" role="status">{message}</p>}
      <Status resource={resource}/>
      <div className="table-scroll"><table>
        <thead><tr>
          <th><input ref={selectAll} type="checkbox" aria-label="이 페이지 상담 전체 선택" checked={allSelected}
            disabled={!items.length} onChange={event=>setSelection(event.target.checked?items.map(item=>item.id):[])}/></th>
          <th>신청번호</th><th>이름</th><th>유형</th><th>상태</th><th>접수 시간</th><th>상세</th>
        </tr></thead>
        <tbody>{items.map(item=><tr key={item.id}>
          <td><input type="checkbox" aria-label={item.receipt+' 선택'} checked={selection.includes(item.id)} onChange={event=>{
            const checked=event.target.checked;
            setSelection(prior=>checked?[...prior,item.id]:prior.filter(id=>id!==item.id));
          }}/></td>
          <td>{item.receipt}</td><td>{item.name}</td><td>{item.service}</td><td>{item.status}</td><td>{formatTime(item.created_at)}</td>
          <td><button className="btn" type="button" onClick={()=>setDetailId(item.id)}>보기</button></td>
        </tr>)}</tbody>
      </table></div>
      {resource.data&&!items.length&&<p className="message">해당 상담이 없습니다.</p>}
      <div className="actions">
        <button className="btn" type="button" disabled={page<1} onClick={()=>filter({page:String(page-1)})}>이전</button>
        <button className="btn" type="button" disabled={!resource.data?.more} onClick={()=>filter({page:String(page+1)})}>다음</button>
      </div>
    </section>
    {adding&&<ManualLeadForm onClose={()=>setAdding(false)} onCreated={onCreated}/>}
    {detailId&&<LeadDetails key={detailId} id={detailId} onClose={()=>setDetailId('')} onSaved={resource.retry}/>}
    {deleteIds.length>0&&<Modal title="선택한 상담 삭제" onClose={()=>{if(!deleting)setDeleteIds([]);}}>
      <p>선택한 상담 {deleteIds.length}건과 해당 개인정보를 영구 삭제합니다.</p>
      {deleteError&&<p className="message error" role="alert">{deleteError}</p>}
      <div className="actions">
        <button className="btn" type="button" disabled={deleting} onClick={()=>setDeleteIds([])}>취소</button>
        <button className="btn danger" type="button" disabled={deleting} onClick={deleteSelected}>{deleting?'삭제 중…':'삭제 확인'}</button>
      </div>
    </Modal>}
  </>;
}
