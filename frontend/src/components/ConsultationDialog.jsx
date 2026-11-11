import { lazy,Suspense,useEffect,useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ConsultationContext } from './ConsultationLink.jsx';
import { Modal } from './common.jsx';

const ConsultationForm=lazy(()=>import('../pages/Consultation.jsx').then(module=>({default:module.ConsultationForm})));

export default function ConsultationDialog({children}) {
  const {pathname}=useLocation();
  const [request,setRequest]=useState(null),[phone,setPhone]=useState(null),[busy,setBusy]=useState(false);
  useEffect(()=>{setRequest(null);setBusy(false);},[pathname]);
  return <ConsultationContext.Provider value={{open:setRequest,setPhone}}>
    {children}
    {request&&<Modal title="상담 신청" className="consultation-dialog" onClose={()=>{if(!busy)setRequest(null);}}>
      <Suspense fallback={<p role="status">상담 신청 창을 불러오는 중…</p>}>
        <ConsultationForm {...request} {...(request.fromPhone?phone:null)} onBusyChange={setBusy}/>
      </Suspense>
    </Modal>}
  </ConsultationContext.Provider>;
}
