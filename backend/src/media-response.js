export function byteRange(header,size) {
  const match=/^bytes=(\d*)-(\d*)$/.exec(header);
  if(!match||(!match[1]&&!match[2])||size<1)return null;
  const offset=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
  const end=match[1]&&match[2]?Math.min(Number(match[2]),size-1):size-1;
  if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(end)||offset>=size||end<offset)return null;
  return {offset,length:end-offset+1,end};
}
export async function serveMedia(store,key,request) {
  const requested=request.headers.get('Range');
  const meta=(requested||request.method==='HEAD')&&store.head?await store.head(key):null;
  if((requested||request.method==='HEAD')&&store.head&&!meta)return null;
  const range=requested&&meta?byteRange(requested,meta.size):null;
  if(requested&&meta&&!range)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+meta.size,'Accept-Ranges':'bytes'}});
  const item=request.method==='HEAD'&&meta?meta:await store.get(key,range?{range:{offset:range.offset,length:range.length}}:undefined);
  if(!item)return null;
  const headers={'Content-Type':item.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'public,max-age=31536000,immutable','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'};
  if(range)headers['Content-Range']='bytes '+range.offset+'-'+range.end+'/'+meta.size;
  if(Number.isSafeInteger(range?.length??item.size))headers['Content-Length']=String(range?.length??item.size);
  return new Response(request.method==='HEAD'?null:item.body,{status:range?206:200,headers});
}
