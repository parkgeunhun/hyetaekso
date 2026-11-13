import {useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {api} from '../services/api.js';

const won=value=>Number(value).toLocaleString('ko-KR')+'원';
export default function SupportSetup({products=[],onConnected}) {
  const [selection,setSelection]=useState({carrier:'SKT',network:'5G',maker:'삼성전자',model:'',plan:''});
  const [catalog,setCatalog]=useState(null),[preview,setPreview]=useState(null),[productId,setProductId]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(null);
  const requestKey=useRef(null);
  function change(key,value){
    const reset=['carrier','network','maker'].includes(key);
    setSelection(prior=>({...prior,...(reset?{model:'',plan:''}:{}),[key]:value}));
    if(reset)setCatalog(null);
    setPreview(null);setSaved(null);setProductId('');setError('');requestKey.current=null;
  }
  async function load(){
    setBusy(true);setError('');setPreview(null);setSaved(null);
    try{setCatalog(await api('/admin/sync/catalog?'+new URLSearchParams(selection)));}
    catch(error){setError(error.message);}finally{setBusy(false);}
  }
  async function check(event){
    event.preventDefault();setBusy(true);setError('');setPreview(null);setSaved(null);requestKey.current=null;
    try{setPreview(await api('/admin/sync/preview',{method:'POST',body:selection}));}
    catch(error){setError(error.message);}finally{setBusy(false);}
  }
  async function connect(){
    setBusy(true);setError('');requestKey.current??=crypto.randomUUID();
    try{
      setSaved(await api('/admin/sync/connect',{method:'POST',body:{...selection,productId,version:preview.version,requestKey:requestKey.current}}));
      onConnected();
    }catch(error){setError(error.message);}finally{setBusy(false);}
  }
  return <section className="admin-panel support-setup" aria-labelledby="support-setup-title">
    <h2 id="support-setup-title">공식 상품 연결</h2>
    <p>통신사·휴대폰·요금제를 이름으로 선택하면 실제 출고가와 지원금을 조회합니다. 새 휴대폰은 비공개로 저장됩니다.</p>
    <form onSubmit={check}>
      <fieldset className="form-stack" disabled={busy}>
        <legend className="sr-only">공식 지원금 조회 조건</legend>
        <div className="settings-grid">
          <label>조회 통신사<select value={selection.carrier} onChange={e=>change('carrier',e.target.value)}>{['SKT','KT','LG U+'].map(name=><option key={name}>{name}</option>)}</select></label>
          <label>통신망<select value={selection.network} onChange={e=>change('network',e.target.value)}><option>5G</option><option>LTE</option></select></label>
          <label>조회 제조사<select value={selection.maker} onChange={e=>change('maker',e.target.value)}>{['삼성전자','애플','기타'].map(name=><option key={name}>{name}</option>)}</select></label>
        </div>
        <button className="btn" type="button" onClick={load}>{busy?'조회 중…':'공식 목록 불러오기'}</button>
        {catalog&&<>
          <div className="settings-grid">
            <label>공식 휴대폰<select required value={selection.model} onChange={e=>change('model',e.target.value)}><option value="">휴대폰 선택</option>{catalog.models.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>공식 요금제<select required value={selection.plan} onChange={e=>change('plan',e.target.value)}><option value="">요금제 선택</option>{catalog.plans.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          </div>
          {(!catalog.models.length||!catalog.plans.length)&&<p role="status">선택한 조건의 공개 목록이 없습니다. 통신망이나 제조사를 변경해 주세요.</p>}
          <button className="btn primary" disabled={!selection.model||!selection.plan}>지원금 확인</button>
        </>}
      </fieldset>
    </form>
    {preview&&!saved&&<div className="support-preview">
      <h3>{preview.name} · {preview.storage}</h3>
      <p>{preview.carrier} · {preview.planName} · 월 {won(preview.fee)}</p>
      <p>공식 출고가 <strong>{won(preview.price)}</strong></p>
      <ul>{preview.supports.map(item=><li key={item.join}>{item.join}: <strong>{won(item.amount)}</strong><small>{item.source}</small></li>)}</ul>
      <p>추가 지원금은 자동으로 입력하지 않습니다. 유효한 수동 지원금은 계속 우선 적용됩니다.</p>
      <label>저장할 휴대폰<select value={productId} disabled={busy} onChange={e=>{setProductId(e.target.value);requestKey.current=null;}}>
        <option value="">새 비공개 휴대폰 만들기</option>
        {products.filter(item=>!item.sample&&!item.closed&&item.name.trim()===preview.name.trim()).map(item=><option key={item.id} value={item.id}>{item.name} · 기존 상품</option>)}
      </select></label>
      <button type="button" className="btn primary" disabled={busy} onClick={connect}>{busy?'연결 중…':'연결하고 지원금 저장'}</button>
    </div>}
    {error&&<p className="message error" role="alert">{error}</p>}
    {saved&&<div className="message" role="status"><strong>{saved.name} · {saved.updated}개 가입 조건 연결 완료</strong>
      <p>{saved.status==='draft'?'비공개 상품으로 저장했습니다. 휴대폰 관리에서 사진과 설명을 채우고 공개할 수 있습니다.':'기존 상품의 지원금 연결을 저장했습니다.'}</p>
      <Link to="/admin/products">휴대폰 관리 열기</Link></div>}
  </section>;
}
