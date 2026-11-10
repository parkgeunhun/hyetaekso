import { useState } from 'react';
import { Link,useParams } from 'react-router-dom';
import { useResource } from '../hooks/data.js';
import { api } from '../services/api.js';
import { Breadcrumb,Section,Status } from '../components/common.jsx';
import { boardTitles } from './content.js';
export default function Board() {
  const {kind,id}=useParams(), title=boardTitles[kind],data=useResource(title?'/content/'+kind+(id?'/'+encodeURIComponent(id):''):null);
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  if(!title)return <Section title="게시판을 찾을 수 없습니다."/>;
  async function submit(e) {
    e.preventDefault();const form=e.currentTarget;setBusy(true);
    try {const result=await api('/content/'+kind,{method:'POST',body:Object.fromEntries(new FormData(form))});setMessage(result.message);form.reset();}
    catch(error){setMessage(error.message);}finally{setBusy(false);}
  }
  const item=id?data.data:null;
  return <><Breadcrumb title={title}/><Section title={item?.title||title}><Status resource={data}/>
    {item?<article className="form-panel">{item.image&&<img loading="lazy" src={item.image} alt=""/>}<p className="preserve">{item.body}</p><Link className="btn" to={'/board/'+kind}>목록 보기</Link></article>:
      !id&&<div className="board-list">{data.data?.map(row=><Link to={'/board/'+kind+'/'+row.id} key={row.id}><strong>{row.title}</strong><span>›</span></Link>)}{data.data&&!data.data.length&&<p className="message">등록된 게시물이 없습니다.</p>}</div>}
    {!id&&['review','qna'].includes(kind)&&<form className="form-panel" onSubmit={submit}><h2>{kind==='qna'?'질문 남기기':'후기 남기기'}</h2><p>연락처 등 개인정보는 입력하지 마세요. 관리자가 확인한 후 공개합니다.</p><label>제목<input name="title" maxLength="160" required/></label><label>내용<textarea name="body" rows="4" maxLength="5000" required/></label><button className="btn primary" disabled={busy}>등록</button>{message&&<p role="status">{message}</p>}</form>}
  </Section></>;
}
