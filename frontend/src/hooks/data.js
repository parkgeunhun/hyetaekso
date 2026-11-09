import { useEffect,useState,useCallback } from 'react';
import { api } from '../services/api.js';

export function useResource(path) {
  const [attempt,retry]=useState(0);
  const [state,setState]=useState({loading:true,data:null,error:null});
  useEffect(()=>{
    if(!path)return;
    const controller=new AbortController();
    setState({loading:true,data:null,error:null});
    api(path,{signal:controller.signal}).then(data=>setState({loading:false,data,error:null}),
      error=>{if(!controller.signal.aborted)setState({loading:false,data:null,error});});
    return ()=>controller.abort();
  },[path,attempt]);
  return {...state,retry:useCallback(()=>retry(value=>value+1),[])};
}
