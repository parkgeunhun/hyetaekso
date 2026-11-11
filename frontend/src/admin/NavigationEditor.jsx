import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Status } from '../components/common.jsx';
import { useResource } from '../hooks/data.js';
import { api } from '../services/api.js';
import { defaultNavigation } from '../../../shared/navigation.js';
import CopyCode,{ CopyCodeHeader } from './CopyCode.jsx';

export default function NavigationEditor({onChanged}) {
  const resource = useResource('/admin/navigation');
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (resource.data) setItems(resource.data);
  }, [resource.data]);

  function update(slug, change) {
    setItems(current => current.map(item => item.slug === slug ? {...item, ...change} : item));
    setResult(null);
  }

  function move(index, direction) {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + direction, 0, item);
    setItems(next);
    setResult(null);
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      setItems(await api('/admin/navigation', {method:'PUT', body:{items}}));
      setResult({message:'메뉴를 저장했습니다.'});
      onChanged();
    } catch (error) {
      setResult({message:error.message,error:true});
    } finally {
      setBusy(false);
    }
  }

  return <><div className="admin-head"><div><h1>메뉴 관리</h1><p>상단 메뉴, 홈 바로가기, 사이트맵에 표시할 이름과 순서를 변경합니다.</p></div></div>
    <Status resource={resource}/>
    {resource.data&&<form className="admin-panel form-stack" onSubmit={save}>
      <fieldset className="editor-fieldset" disabled={busy}>
        <legend>서비스 메뉴</legend>
        <div className="table-scroll"><table><thead><tr><th>페이지</th><th>메뉴 이름</th><th>표시</th><th>순서</th><CopyCodeHeader/></tr></thead><tbody>
          {items.map((item,index)=>{
            const name=defaultNavigation.find(entry=>entry.slug===item.slug).label;
            return <tr key={item.slug}>
              <td><Link to={'/admin/page-'+item.slug}>{name} 편집</Link></td>
              <td><input aria-label={name+' 메뉴 이름'} value={item.label} required maxLength={40} onChange={e=>update(item.slug,{label:e.target.value})}/></td>
              <td><label className="checkbox"><input type="checkbox" checked={item.visible} onChange={e=>update(item.slug,{visible:e.target.checked})}/>표시</label></td>
              <td><button className="btn" type="button" aria-label={name+' 위로'} disabled={index===0} onClick={()=>move(index,-1)}>↑</button>{' '}<button className="btn" type="button" aria-label={name+' 아래로'} disabled={index===items.length-1} onClick={()=>move(index,1)}>↓</button></td>
              <td className="code-copy-cell"><CopyCode code={item.slug} label={item.label}/></td>
            </tr>;
          })}
        </tbody></table></div>
        <button className="btn primary" type="submit" disabled={!items.length}>{busy?'저장 중…':'메뉴 저장'}</button>
      </fieldset>
      {result&&<p role={result.error?'alert':'status'} className={'message '+(result.error?'error':'')}>{result.message}</p>}
    </form>}
  </>;
}
