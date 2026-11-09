import { lazy,Suspense } from 'react';
import { Route,Routes,Link,Navigate } from 'react-router-dom';
import SiteLayout from './layouts/SiteLayout.jsx';
import { Home,ServicePage,Legal,Sitemap } from './pages/Services.jsx';
import { pages } from './pages/content.js';
import { Section } from './components/common.jsx';

const Admin=lazy(()=>import('./admin/Admin.jsx'));
const Catalog=lazy(()=>import('./pages/Phones.jsx').then(mod=>({default:mod.Catalog})));
const PhoneDetail=lazy(()=>import('./pages/Phones.jsx').then(mod=>({default:mod.PhoneDetail})));
const Consultation=lazy(()=>import('./pages/Consultation.jsx').then(mod=>({default:mod.Consultation})));
const Lookup=lazy(()=>import('./pages/Consultation.jsx').then(mod=>({default:mod.Lookup})));
const Board=lazy(()=>import('./pages/Board.jsx'));
export default function App() {
  return <Suspense fallback={<p className="message" role="status">화면을 불러오는 중…</p>}><Routes>
    <Route path="/admin/:section?" element={<Admin/>}/>
    <Route element={<SiteLayout/>}>
      <Route index element={<Home/>}/>
      {Object.keys(pages).map(slug=><Route key={slug} path={slug} element={<ServicePage key={slug} slug={slug}/>}/>)}
      <Route path="phones" element={<Catalog/>}/><Route path="phones/:id" element={<PhoneDetail/>}/>
      <Route path="catalog" element={<Navigate replace to="/phones"/>}/>
      <Route path="consult" element={<Consultation/>}/><Route path="lookup" element={<Lookup/>}/>
      <Route path="board/:kind/:id?" element={<Board/>}/>
      <Route path="privacy" element={<Legal kind="privacy"/>}/><Route path="terms" element={<Legal kind="terms"/>}/>
      <Route path="sitemap" element={<Sitemap/>}/>
      <Route path="*" element={<Section title="페이지를 찾을 수 없습니다"><Link to="/">홈으로 돌아가기</Link></Section>}/>
    </Route>
  </Routes></Suspense>;
}
