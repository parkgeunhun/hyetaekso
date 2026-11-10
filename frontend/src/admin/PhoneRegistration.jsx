import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { blankFields, EditorFields, mediaUploading } from './Editors.jsx';
import { entities } from './fields.js';

const groups = [
  {key: 'capacities', title: '용량·출고가', addLabel: '용량 추가', limit: 20},
  {key: 'colors', title: '색상·사진', addLabel: '색상 추가', limit: 30},
  {key: 'offers', title: '가격 조건', addLabel: '가격 조건 추가', limit: 200}
];

const fields = Object.fromEntries(groups.map(({key}) => [
  key,
  entities[key].fields.filter(([field]) => field !== 'product_id' && field !== 'capacity_id')
]));

function newRow(type) {
  return {key: crypto.randomUUID(), ...blankFields(fields[type]), ...(type === 'offers' ? {capacityKey: ''} : {})};
}

export default function PhoneRegistration({refs, onChanged}) {
  const [product, setProduct] = useState(() => blankFields(entities.products.fields));
  const [options, setOptions] = useState({capacities: [], colors: [], offers: []});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(null);
  const requestKey = useRef(null);
  const activeRefs = {...refs, plans: (refs.plans ?? []).filter(plan => plan.enabled)};

  function add(type) {
    setOptions(prior => ({...prior, [type]: [...prior[type], newRow(type)]}));
  }

  function update(type, key, updater) {
    setOptions(prior => ({
      ...prior,
      [type]: prior[type].map(row => row.key === key ? updater(row) : row)
    }));
  }

  function remove(type, key) {
    setOptions(prior => {
      const next = {...prior, [type]: prior[type].filter(row => row.key !== key)};
      if (type === 'capacities') {
        next.offers = next.offers.map(row => row.capacityKey === key ? {...row, capacityKey: ''} : row);
      }
      return next;
    });
  }

  async function save(event) {
    event.preventDefault();
    if (mediaUploading(event.currentTarget)) {
      setError('파일 업로드가 끝난 후 저장해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    requestKey.current ??= crypto.randomUUID();
    try {
      setSaved(await api('/admin/phone-registration', {
        method: 'POST', body: {requestKey: requestKey.current, product, ...options}
      }));
      onChanged();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="admin-head">
      <div><h1>휴대폰 등록</h1><p>상품, 용량, 색상과 가격 조건을 한 번에 저장합니다.</p></div>
      <Link className="btn" to="/admin/products">상품 목록</Link>
    </div>
    {saved ? <section className="admin-panel success" role="status">
      <h2>{saved.name} 등록 완료</h2>
      <Link className="btn" to="/admin/products">등록한 상품 확인</Link>
      {product.status === 'published'&&<Link className="btn" to={'/phones/'+saved.id}>공개 상품 보기</Link>}
    </section> : <form className="form-stack" onSubmit={save}>
      <fieldset className="admin-panel editor-fieldset" disabled={busy}>
        <legend>상품 정보</legend>
        <EditorFields fields={entities.products.fields} form={product} setForm={setProduct} refs={refs} mediaCategory="phone"/>
        {refs.manufacturers?.length===0&&<Link to="/admin/manufacturers">제조사 등록하기</Link>}
      </fieldset>
      {groups.map(group=>{
        const {key, title, addLabel, limit} = group;
        const disabled = key==='offers'&&(!options.capacities.length||!activeRefs.plans.length);
        return <fieldset key={key} className="admin-panel editor-fieldset" disabled={busy}>
          <legend>{title}</legend>
          {key==='offers'&&disabled&&<p>가격 조건을 추가하려면 용량과 사용 중인 요금제가 필요합니다.</p>}
          {options[key].map((row, index)=><div key={row.key} className="option-row form-stack">
            <div className="admin-head"><strong>{title} {index+1}</strong>
              <button type="button" className="btn" onClick={()=>remove(key,row.key)} aria-label={title+' '+(index+1)+' 삭제'}>삭제</button>
            </div>
            {key==='offers'&&<label>연결할 용량<select required value={row.capacityKey} onChange={e=>update(key,row.key,prior=>({...prior,capacityKey:e.target.value}))}>
              <option value="">선택</option>
              {options.capacities.map((capacity,i)=><option key={capacity.key} value={capacity.key}>{capacity.name||'용량 '+(i+1)}</option>)}
            </select></label>}
            <EditorFields fields={fields[key]} form={row} setForm={updater=>update(key,row.key,updater)} refs={activeRefs} mediaCategory="phone"/>
          </div>)}
          <button className="btn" type="button" onClick={()=>add(key)} disabled={disabled||options[key].length>=limit}>{addLabel}</button>
        </fieldset>;
      })}
      {error&&<p role="alert" className="message error">{error}</p>}
      <button className="btn primary" type="submit" disabled={busy}>{busy ? '저장 중…' : '휴대폰 저장'}</button>
    </form>}
  </>;
}
