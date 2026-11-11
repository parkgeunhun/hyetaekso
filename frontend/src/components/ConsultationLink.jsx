import { createContext,useContext } from 'react';
import { Link } from 'react-router-dom';

export const ConsultationContext=createContext(null);
export const useConsultation=()=>useContext(ConsultationContext);

export function ConsultationLink({service,detail,fromPhone=false,children,...props}) {
  const context=useConsultation();
  const query=new URLSearchParams();
  if(service)query.set('service',service);
  if(detail)query.set('detail',detail);
  const path='/consult'+(query.size?'?'+query:'');
  return <Link {...props} to={path} onClick={event=>{
    if(!context||event.defaultPrevented||event.button!==0||event.metaKey||event.altKey||event.ctrlKey||event.shiftKey)return;
    event.preventDefault();
    context.open({initialService:service,detail,fromPhone});
  }}>{children}</Link>;
}
