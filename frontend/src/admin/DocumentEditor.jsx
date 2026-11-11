import { useRef,useState } from 'react';
import { RichText } from '../components/RichText.jsx';

export default function DocumentEditor({label,value,update}) {
  const input=useRef(null);
  const [preview,setPreview]=useState(false);

  function insert(prefix,suffix='',sample='',block=false) {
    const field=input.current;
    const {selectionStart:start,selectionEnd:end}=field;
    const selected=value.slice(start,end)||sample;
    const before=value.slice(0,start),after=value.slice(end);
    const separator=block&&before&&!before.endsWith('\n')?'\n':'';
    const trailing=block&&after&&!after.startsWith('\n')?'\n':'';
    const content=block?selected.split('\n').map(line=>prefix+line).join('\n'):prefix+selected+suffix;
    const next=before+separator+content+trailing+after;
    if(next.length>50000)return;
    update(next);
    requestAnimationFrame(()=>{
      field.focus();
      const first=start+separator.length+prefix.length;
      field.setSelectionRange(first,first+selected.length);
    });
  }

  return <section className="document-editor" aria-label={label+' 편집기'}>
    <div className="document-editor-head">
      <h2>{label}</h2>
      <button type="button" className="btn" aria-pressed={preview} onClick={()=>setPreview(!preview)}>{preview?'본문 편집':'미리보기'}</button>
    </div>
    {preview?<RichText className="document-preview" text={value}/>:<>
      <div className="actions document-tools" role="group" aria-label="문서 서식">
        <button type="button" className="btn" onClick={()=>insert('# ','','제목',true)}>제목</button>
        <button type="button" className="btn" onClick={()=>insert('## ','','소제목',true)}>소제목</button>
        <button type="button" className="btn" onClick={()=>insert('**','**','강조할 문구')}>굵게</button>
        <button type="button" className="btn" onClick={()=>insert('- ','','목록 항목',true)}>목록</button>
        <button type="button" className="btn" onClick={()=>insert('[','](https://example.com)','링크 문구')}>링크</button>
      </div>
      <textarea aria-label={label} ref={input} rows={12} maxLength={50000} value={value} onChange={event=>update(event.target.value)}/>
    </>}
  </section>;
}
