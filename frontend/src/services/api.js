export async function api(path,options={}) {
  const {method='GET',body,signal,raw=false}=options;
  const response=await fetch('/api'+path,{method,signal,credentials:'same-origin',headers:body==null?{}:{'Content-Type':raw?body.type:'application/json'},body:body==null?undefined:raw?body:JSON.stringify(body)});
  const data=await response.json().catch(()=>null);
  if(!response.ok||data===null) {
    const error=new Error(data?.error?.message||'서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
    error.status=response.status;error.code=data?.error?.code;throw error;
  }
  return data;
}
