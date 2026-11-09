import { useEffect,useState,useCallback } from 'react';
import { api } from '../services/api.js';

const pending={loading:true,data:null,error:null};

export function useResource(path,{keepData=false}={}) {
  const [attempt,retry]=useState(0);
  const [state,setState]=useState(null);
  useEffect(()=>{
    if(!path)return;
    const controller=new AbortController();
    setState(prior=>({...pending,path,data:keepData&&prior?.path===path?prior.data:null}));
    api(path,{signal:controller.signal}).then(
      data=>{if(!controller.signal.aborted)setState({path,loading:false,data,error:null});},
      error=>{if(!controller.signal.aborted)setState({path,loading:false,data:null,error});});
    return ()=>controller.abort();
  },[path,attempt,keepData]);
  return {...(state?.path===path?state:pending),retry:useCallback(()=>retry(value=>value+1),[])};
}
