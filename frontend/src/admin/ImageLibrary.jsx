import { useState } from 'react';
import { createPortal } from 'react-dom';
import { mediaAccept, mediaCategories } from '../../../shared/media-library.js';
import { Modal, Status } from '../components/common.jsx';
import { useResource } from '../hooks/data.js';
import { api } from '../services/api.js';
import CopyCode from './CopyCode.jsx';

export function uploadMedia(file, category) {
  const params = new URLSearchParams({name:file.name.trim().slice(0,160)||'새 파일',category});
  return api('/admin/media?'+params,{method:'POST',body:file,raw:true});
}

function CategoryOptions({all}) {
  return <>
    {all&&<option value="all">전체 분류</option>}
    {Object.entries(mediaCategories).map(([value,label])=><option key={value} value={value}>{label}</option>)}
  </>;
}

function Gallery({initialCategory,kind,onSelect,onEdit}) {
  const [category,setCategory]=useState(initialCategory);
  const [filterKind,setFilterKind]=useState(kind);
  const [query,setQuery]=useState('');
  const [page,setPage]=useState(0);
  const [selected,setSelected]=useState([]);
  const [removing,setRemoving]=useState(null);
  const [deleting,setDeleting]=useState(false);
  const [message,setMessage]=useState('');
  const [deleteError,setDeleteError]=useState('');
  const resource=useResource('/admin/media?'+new URLSearchParams({category,kind:filterKind,q:query,page}));
  const change=setter=>event=>{setter(event.target.value);setSelected([]);setPage(0);setMessage('');};
  const items=(resource.data?.items??[]).map(item=>item.label===item.id?
    {...item,label:item.kind==='video'?'이름 없는 동영상':'이름 없는 이미지'}:item);
  const uploads=items.filter(item=>item.source==='upload');
  const selectedFiles=uploads.filter(item=>selected.includes(item.id));
  const allSelected=uploads.length>0&&selectedFiles.length===uploads.length;

  function choosePage(next) {
    setPage(next);setSelected([]);setMessage('');
  }

  function confirmDelete(files) {
    setMessage('');setDeleteError('');setRemoving(files);
  }

  async function deleteFiles() {
    setDeleting(true);setDeleteError('');
    const ids=removing.map(file=>file.id);
    try {
      const {deleted}=ids.length===1?await api('/admin/media/'+ids[0],{method:'DELETE'}):
        await api('/admin/media',{method:'DELETE',body:{ids}});
      setRemoving(null);
      setSelected(current=>current.filter(id=>!ids.includes(id)));
      if(page>0&&items.every(item=>ids.includes(item.id)))setPage(page-1);
      resource.retry();
      setMessage(deleted?deleted+'개 파일을 삭제했습니다.':'목록에서 이미 삭제된 파일입니다.');
    } catch(error) {
      setDeleteError(error.message);
    } finally {
      setDeleting(false);
    }
  }

  return <section className="media-gallery" aria-label="보관함 파일 목록">
    <div className="filters media-gallery-filters">
      {onSelect&&<label>이미지 분류<select value={category} onChange={change(setCategory)}><CategoryOptions all/></select></label>}
      {kind==='all'&&<label>파일 유형<select value={filterKind} onChange={change(setFilterKind)}><option value="all">전체</option><option value="image">이미지</option><option value="video">동영상</option></select></label>}
      <label>파일 검색<input type="search" value={query} maxLength={160} placeholder="파일 이름 또는 주소" onChange={change(setQuery)}/></label>
    </div>
    <Status resource={resource}/>
    {message&&<p className="message" role="status">{message}</p>}
    {resource.data&&<>
      {!onSelect&&uploads.length>0&&<div className="actions media-library-actions">
        <label className="checkbox"><input type="checkbox" checked={allSelected} onChange={()=>setSelected(allSelected?[]:uploads.map(item=>item.id))}/>이 페이지 전체 선택</label>
        <button className="btn danger" type="button" disabled={!selectedFiles.length} onClick={()=>confirmDelete(selectedFiles)}>선택 삭제{selectedFiles.length>0?' ('+selectedFiles.length+')':''}</button>
      </div>}
      {items.length===0&&<p className="message">이 조건에 해당하는 파일이 없습니다.</p>}
      <div className="media-library-grid">
        {items.map(item=><article className={'media-library-card '+(selected.includes(item.id)?'media-library-selected':'')} key={item.url}>
          <div className="media-library-preview">
            {item.kind==='video'?<video src={item.url} preload="metadata" controls/>:<img src={item.url} alt="" loading="lazy" referrerPolicy="no-referrer"/>}
            {!onSelect&&item.source==='upload'&&<label className="media-library-check">
              <input type="checkbox" aria-label={item.label+' 선택'} checked={selected.includes(item.id)} onChange={event=>{
                const checked=event.target.checked;
                setSelected(current=>checked?[...current,item.id]:current.filter(id=>id!==item.id));
              }}/>
            </label>}
          </div>
          <strong title={item.label}>{item.label}</strong>
          <div className="media-card-meta">
            <small>{item.inUse?'사용 중':item.source==='builtin'?'기본 제공':item.source==='reference'?'사이트 참조':mediaCategories[item.category]}</small>
            {!onSelect&&item.source==='upload'&&<CopyCode code={item.id} label={item.label}/>}
          </div>
          {onSelect?<button className="btn" type="button" aria-label={item.label+' 선택'} onClick={()=>onSelect(item.url)}>선택</button>:
            item.source==='upload'&&<div className="media-card-actions">
              <button className="btn" type="button" aria-label={item.label+' 이름·분류 수정'} onClick={()=>onEdit(item)}>수정</button>
              <button className="btn" type="button" aria-label={item.label+' 삭제'} onClick={()=>confirmDelete([item])}>삭제</button>
            </div>}
        </article>)}
      </div>
      {(page>0||resource.data.more)&&<div className="actions">
        <button className="btn" type="button" disabled={!page} onClick={()=>choosePage(page-1)}>이전</button>
        <span>{page+1} 페이지</span>
        <button className="btn" type="button" disabled={!resource.data.more} onClick={()=>choosePage(page+1)}>다음</button>
      </div>}
    </>}
    {removing&&<Modal title={removing.length+'개 파일 삭제'} onClose={()=>{if(!deleting)setRemoving(null);}}>
      <p>선택한 업로드 파일을 보관함과 DB에서 삭제합니다.</p>
      <ul className="media-delete-list">{removing.map(file=><li key={file.id}>{file.label}</li>)}</ul>
      {deleteError&&<p className="message error" role="alert">{deleteError}</p>}
      <div className="actions">
        <button className="btn" type="button" disabled={deleting} onClick={()=>setRemoving(null)}>취소</button>
        <button className="btn danger" type="button" disabled={deleting} onClick={deleteFiles}>{deleting?'삭제 중…':'삭제 확인'}</button>
      </div>
    </Modal>}
  </section>;
}

export function MediaPicker({type,category,onSelect,onClose}) {
  const kind=type==='picture'?'image':type==='video'?'video':'all';
  return createPortal(<Modal title="이미지 보관함에서 선택" onClose={onClose}>
    <Gallery initialCategory={category} kind={kind} onSelect={onSelect}/>
  </Modal>,document.body);
}

function EditMedia({item,onClose,onSaved}) {
  const [label,setLabel]=useState(item.label);
  const [category,setCategory]=useState(item.category);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function save(event) {
    event.preventDefault();
    setBusy(true);setError('');
    try {
      await api('/admin/media/'+item.id,{method:'PATCH',body:{label,category}});
      onSaved();
    } catch(error) {setError(error.message);} finally {setBusy(false);}
  }
  return <Modal title="파일 이름·분류 수정" onClose={()=>{if(!busy)onClose();}}>
    <form className="form-stack" onSubmit={save}>
      <label>파일 이름<input value={label} onChange={event=>setLabel(event.target.value)} maxLength={160} required/></label>
      <label>이미지 분류<select value={category} onChange={event=>setCategory(event.target.value)}><CategoryOptions/></select></label>
      {error&&<p className="message error" role="alert">{error}</p>}
      <button className="btn primary" disabled={busy}>저장</button>
    </form>
  </Modal>;
}

export default function ImageLibrary({category,title}) {
  const [uploadCategory,setUploadCategory]=useState(category==='all'?'other':category);
  const [version,setVersion]=useState(0);
  const [edit,setEdit]=useState(null);
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState(null);

  async function upload(event) {
    const input=event.currentTarget;
    const file=input.files[0];
    if(!file)return;
    setBusy(true);setResult(null);
    try {
      await uploadMedia(file,uploadCategory);
      setVersion(current=>current+1);
      setResult({message:mediaCategories[uploadCategory]+'에 저장했습니다.'});
    } catch(error) {setResult({message:error.message,error:true});}
    finally {input.value='';setBusy(false);}
  }

  return <>
    <div className="admin-head"><div><h1>{title}</h1><p>사진과 동영상을 한곳에 보관하고 배너, 상품, 서비스 화면에서 다시 선택할 수 있습니다.</p></div></div>
    <div className="admin-panel filters">
      {category==='all'&&<label>저장할 분류<select disabled={busy} value={uploadCategory} onChange={event=>setUploadCategory(event.target.value)}><CategoryOptions/></select></label>}
      <label>파일 업로드<input type="file" accept={mediaAccept.picture+','+mediaAccept.video} onChange={upload} disabled={busy}/></label>
      {busy&&<p role="status">업로드 중…</p>}
      {result&&<p role={result.error?'alert':'status'} className={'message '+(result.error?'error':'')}>{result.message}</p>}
    </div>
    <div className="admin-panel"><Gallery key={version} initialCategory={category} kind="all" onEdit={setEdit}/></div>
    {edit&&<EditMedia item={edit} onClose={()=>setEdit(null)} onSaved={()=>{setEdit(null);setVersion(current=>current+1);}}/>}
  </>;
}
