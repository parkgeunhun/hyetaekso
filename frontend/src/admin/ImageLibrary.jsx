import { useState } from 'react';
import { createPortal } from 'react-dom';
import { mediaAccept, mediaCategories } from '../../../shared/media-library.js';
import { Modal, Status } from '../components/common.jsx';
import { useResource } from '../hooks/data.js';
import { api } from '../services/api.js';

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
  const resource=useResource('/admin/media?'+new URLSearchParams({category,kind:filterKind,q:query,page}));
  const change=setter=>event=>{setter(event.target.value);setPage(0);};

  return <section className="media-gallery" aria-label="보관함 파일 목록">
    <div className="filters media-gallery-filters">
      {onSelect&&<label>이미지 분류<select value={category} onChange={change(setCategory)}><CategoryOptions all/></select></label>}
      {kind==='all'&&<label>파일 유형<select value={filterKind} onChange={change(setFilterKind)}><option value="all">전체</option><option value="image">이미지</option><option value="video">동영상</option></select></label>}
      <label>파일 검색<input type="search" value={query} maxLength={160} placeholder="파일 이름 또는 주소" onChange={change(setQuery)}/></label>
    </div>
    <Status resource={resource}/>
    {resource.data&&<>
      {resource.data.items.length===0&&<p className="message">이 조건에 해당하는 파일이 없습니다.</p>}
      <div className="media-library-grid">
        {resource.data.items.map(item=><article className="media-library-card" key={item.url}>
          <div className="media-library-preview">
            {item.kind==='video'?<video src={item.url} preload="metadata" controls/>:<img src={item.url} alt="" loading="lazy" referrerPolicy="no-referrer"/>}
          </div>
          <strong title={item.label}>{item.label}</strong>
          <small>{mediaCategories[item.category]} · {item.source==='builtin'?'기본 제공':item.source==='reference'?'사이트 참조':'업로드'}</small>
          {onSelect?<button className="btn" type="button" aria-label={item.label+' 선택'} onClick={()=>onSelect(item.url)}>선택</button>:
            item.source==='upload'&&<button className="btn" type="button" aria-label={item.label+' 이름·분류 수정'} onClick={()=>onEdit(item)}>이름·분류 수정</button>}
        </article>)}
      </div>
      {(page>0||resource.data.more)&&<div className="actions">
        <button className="btn" type="button" disabled={!page} onClick={()=>setPage(page-1)}>이전</button>
        <span>{page+1} 페이지</span>
        <button className="btn" type="button" disabled={!resource.data.more} onClick={()=>setPage(page+1)}>다음</button>
      </div>}
    </>}
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
