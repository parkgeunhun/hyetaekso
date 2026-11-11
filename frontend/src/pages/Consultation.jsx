import { useRef,useState } from 'react';
import { Link,useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { useSite } from '../layouts/SiteLayout.jsx';
import { serviceTypes } from './content.js';
import { Breadcrumb,Section } from '../components/common.jsx';
import { RichText } from '../components/RichText.jsx';

function Remaining({name,label}) {
  const [value,setValue]=useState('');
  return <div className="filters"><label>{label}<select name={name} required value={value} onChange={e=>setValue(e.target.value)}><option value="" disabled>선택해 주세요</option><option value="no">없음</option><option value="yes">있음</option></select></label>{value==='yes'&&<label>{label} 금액 (선택)<input type="number" min="1" max="100000000" name={name+'Amount'}/></label>}</div>;
}
export function ConsultationForm({fixedService,detail='',quoteInput,onQuoteChanged}) {
  const {settings}=useSite();
  const [service,setService]=useState(fixedService||'고객문의'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null);
  const key=useRef(null);
  async function submit(event) {
    event.preventDefault();setBusy(true);setError('');
    try {
      key.current??=crypto.randomUUID();
      const values=Object.fromEntries(new FormData(event.currentTarget));
      setResult(await api('/consultations',{method:'POST',body:{...values,...quoteInput,service,requestKey:key.current,consent:values.consent==='on'}}));
    } catch(error) {setError(error.message);if(error.code==='quote_changed'&&onQuoteChanged)setError(error.message+' 아래에서 새 견적을 불러오세요.');}
    finally {setBusy(false);}
  }
  if(result)return <div className="form-panel success" role="status"><h2>{result.message}</h2><p>신청번호 <strong>{result.receipt}</strong></p><Link className="btn" to="/lookup">신청 내역 조회</Link></div>;
  if(!settings.intake)return <p className="message">온라인 상담 접수를 준비하고 있습니다.</p>;
  return <form className="form-panel consultation-form" onSubmit={submit}>
    <h2>상담 신청</h2>{!quoteInput?.offerId&&quoteInput&&<p>{settings.help_text}</p>}
    {!fixedService&&<label>상담 유형<select value={service} onChange={e=>setService(e.target.value)}>{serviceTypes.filter(type=>type!=='휴대폰').map(type=><option key={type}>{type}</option>)}</select></label>}
    <div className="filters"><label>이름<input name="name" autoComplete="name" required maxLength="80"/></label><label>휴대폰 번호<input name="phone" type="tel" autoComplete="tel" required maxLength="20"/></label></div>
    {fixedService==='휴대폰'&&<><label>생년월일<input name="birth" type="date" autoComplete="bday" required/></label><Remaining name="penalty" label="남은 위약금"/><Remaining name="balance" label="남은 할부금"/></>}
    <label>상담 내용<textarea name="details" rows="4" maxLength="3000" defaultValue={detail}/></label>
    <RichText text={settings.consent} minHeading={3}/>
    <details className="consultation-consent"><summary>개인정보 수집 동의서 보기</summary><RichText text={settings.privacy} minHeading={3}/></details>
    <label className="checkbox"><input name="consent" type="checkbox" required/>{settings.consent_label||'개인정보 수집·이용에 동의합니다.'}</label>
    <Link to="/privacy">개인정보처리방침 확인</Link>
    {error&&<p role="alert" className="message error">{error}</p>}{error&&onQuoteChanged&&<button type="button" className="btn" onClick={onQuoteChanged}>상품 정보 다시 불러오기</button>}
    <button type="submit" className="btn primary" disabled={busy}>{busy?'접수 중…':'상담 신청하기'}</button>
  </form>;
}
export function Consultation() {
  const [query]=useSearchParams(),kind=query.get('service');
  return <><Breadcrumb title="상담 신청"/><Section title="어떤 도움이 필요하신가요?" className="narrow"><p><Link to="/phones">휴대폰 견적 상담은 모델부터 선택하세요 ›</Link></p><ConsultationForm key={kind} fixedService={serviceTypes.includes(kind)&&kind!=='휴대폰'?kind:null} detail={query.get('detail')||''}/></Section></>;
}
export function Lookup() {
  const [result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(e) {
    e.preventDefault();setBusy(true);setError('');setResult(null);
    try {setResult(await api('/consultations/lookup',{method:'POST',body:Object.fromEntries(new FormData(e.currentTarget))}));}catch(error){setError(error.message);}finally{setBusy(false);}
  }
  return <><Breadcrumb title="상담 신청 내역 조회"/><Section title="상담 신청 내역 조회" className="narrow"><form className="form-panel" onSubmit={submit}><label>신청번호<input name="receipt" required maxLength="64"/></label><label>신청 당시 휴대폰 번호<input name="phone" type="tel" required maxLength="20"/></label><button className="btn primary" disabled={busy}>조회</button>{error&&<p role="alert" className="error message">{error}</p>}</form>{result&&<div className="form-panel" role="status"><b>{result.service} · {result.status}</b><p>{result.receipt}</p></div>}</Section></>;
}
