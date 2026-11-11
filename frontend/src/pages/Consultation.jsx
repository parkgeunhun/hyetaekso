import { useRef,useState } from 'react';
import { Link,useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { useSite } from '../layouts/SiteLayout.jsx';
import { serviceTypes } from './content.js';
import { Breadcrumb,Section } from '../components/common.jsx';
import { RichText } from '../components/RichText.jsx';
import { consultationEmailNotice } from '../../../shared/consultation.js';

function Remaining({name,label}) {
  const [value,setValue]=useState('');
  return <div className="filters"><label>{label}<select aria-label={label} name={name} required value={value} onChange={e=>setValue(e.target.value)}><option value="" disabled>선택해 주세요</option><option value="no">없음</option><option value="yes">있음</option></select></label>{value==='yes'&&<label>{label} 금액 (선택)<input type="number" min="1" max="100000000" name={name+'Amount'}/></label>}</div>;
}
export function ConsultationForm({initialService,detail='',quoteInput,onQuoteChanged,onBusyChange}) {
  const {settings}=useSite();
  const [selectedService,setService]=useState(serviceTypes.includes(initialService)?initialService:'');
  const [editedDetails,setDetails]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(null),[result,setResult]=useState(null);
  const service=quoteInput?'휴대폰':selectedService;
  const key=useRef(null);
  async function submit(event) {
    event.preventDefault();
    if(!settings.intake||busy)return;
    setBusy(true);onBusyChange?.(true);setError(null);
    try {
      key.current??=crypto.randomUUID();
      const values=Object.fromEntries(new FormData(event.currentTarget));
      setResult(await api('/consultations',{method:'POST',body:{...values,...quoteInput,service,requestKey:key.current,consent:values.consent==='on'}}));
    } catch(error) {setError(error);}
    finally {setBusy(false);onBusyChange?.(false);}
  }
  if(result)return <div className="form-panel success" role="status"><h2>{result.message}</h2><p>신청번호 <strong>{result.receipt}</strong></p><Link className="btn" to="/lookup">신청 내역 조회</Link></div>;
  return <form className="consultation-form" onSubmit={submit}>
    <p className="consultation-intro">이름과 연락처를 남겨 주시면 혜택소에서 안내해 드립니다.</p>
    <label>이름<input name="name" autoComplete="name" placeholder="홍길동" required minLength={quoteInput?2:undefined} maxLength={quoteInput?40:80}/></label>
    <label>연락처<input name="phone" type="tel" autoComplete="tel" placeholder="010-1234-5678" required maxLength={20}/></label>
    <label>이메일 (선택)<input name="email" type="email" autoComplete="email" placeholder="hong@email.com" maxLength={254}/>
      <small>{consultationEmailNotice}</small></label>
    <label>상담 유형<select aria-label="상담 유형" required disabled={Boolean(quoteInput)} value={service} onChange={e=>setService(e.target.value)}>
      <option value="" disabled>선택해 주세요</option>{serviceTypes.map(type=><option key={type}>{type}</option>)}
    </select></label>
    <label>문의 내용<textarea name="details" rows={3} maxLength={3000} placeholder="내용을 적어 주세요."
      value={editedDetails??detail} onChange={e=>setDetails(e.target.value)}/></label>
    {quoteInput&&<div className="consultation-phone-fields">
      {!quoteInput.offerId&&<p className="message">{settings.help_text}</p>}
      <label>생년월일<input name="birth" type="date" autoComplete="bday" required/></label>
      <Remaining name="penalty" label="남은 위약금"/><Remaining name="balance" label="남은 할부금"/>
    </div>}
    <details className="consultation-consent"><summary>개인정보 수집 동의서 보기</summary>
      <RichText text={settings.consent} minHeading={3}/><RichText text={settings.privacy} minHeading={3}/>
      <a href="/privacy" target="_blank" rel="noreferrer">개인정보처리방침 새 창에서 열기</a>
    </details>
    <label className="checkbox"><input name="consent" type="checkbox" required/>{settings.consent_label||'개인정보 수집·이용에 동의합니다.'}</label>
    {error&&<p role="alert" className="message error">{error.message}</p>}
    {error?.code==='quote_changed'&&onQuoteChanged&&<button type="button" className="btn" onClick={()=>{onQuoteChanged();setError(null);}}>상품 정보 다시 불러오기</button>}
    {!settings.intake&&<p className="message" role="status">현재 온라인 상담 접수를 준비하고 있습니다.</p>}
    <button type="submit" className="btn primary consultation-submit" disabled={busy||!settings.intake}>{busy?'접수 중…':'상담 신청'}</button>
  </form>;
}
export function Consultation() {
  const [query]=useSearchParams(),kind=query.get('service');
  return <><Breadcrumb title="상담 신청"/><Section title="상담 신청" className="narrow">
    <div className="form-panel consultation-page"><ConsultationForm key={query.toString()} initialService={kind} detail={(query.get('detail')||'').slice(0,3000)}/></div>
  </Section></>;
}
export function Lookup() {
  const [result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(e) {
    e.preventDefault();setBusy(true);setError('');setResult(null);
    try {setResult(await api('/consultations/lookup',{method:'POST',body:Object.fromEntries(new FormData(e.currentTarget))}));}catch(error){setError(error.message);}finally{setBusy(false);}
  }
  return <><Breadcrumb title="상담 신청 내역 조회"/><Section title="상담 신청 내역 조회" className="narrow"><form className="form-panel" onSubmit={submit}><label>신청번호<input name="receipt" required maxLength="64"/></label><label>신청 당시 휴대폰 번호<input name="phone" type="tel" required maxLength="20"/></label><button className="btn primary" disabled={busy}>조회</button>{error&&<p role="alert" className="error message">{error}</p>}</form>{result&&<div className="form-panel" role="status"><b>{result.service} · {result.status}</b><p>{result.receipt}</p></div>}</Section></>;
}
