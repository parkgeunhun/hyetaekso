import { useEffect,useRef,useState } from 'react';
import { Check,Copy } from 'lucide-react';

export function CopyCodeHeader() {
  return <th className="code-copy-cell" scope="col" aria-label="관리 코드 복사"/>;
}

export default function CopyCode({code,label}) {
  const [message,setMessage]=useState('');
  const timer=useRef(null);
  useEffect(()=>()=>clearTimeout(timer.current),[]);

  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(code);
      setMessage('복사됨');
    } catch {
      setMessage('복사할 수 없습니다');
    }
    timer.current=setTimeout(()=>setMessage(''),2500);
  }

  return <span className="code-copy">
    <button className="btn code-copy-button" type="button" title="관리 코드 복사"
      aria-label={label+' 관리 코드 복사'} onClick={copy}>
      {message==='복사됨'?<Check size={16} aria-hidden="true"/>:<Copy size={16} aria-hidden="true"/>}
    </button>
    <span className="code-copy-feedback" role="status">{message}</span>
  </span>;
}
