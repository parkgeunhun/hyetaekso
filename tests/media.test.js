import {test} from 'node:test';
import assert from 'node:assert/strict';
import {serveMedia} from '../backend/src/media-response.js';
test('video media handles Safari partial requests and invalid ranges',async()=>{
  const data=Buffer.from('0123456789'),meta={size:data.length,httpMetadata:{contentType:'video/mp4'}};
  const store={head:async()=>meta,get:async(_,{range}={})=>({...meta,body:range?data.subarray(range.offset,range.offset+range.length):data})};
  const request=(range,method='GET')=>new Request('https://preview.example/api/media/file',{method,headers:range?{Range:range}:{}});
  const first=await serveMedia(store,'file',request('bytes=0-1'));
  assert.equal(first.status,206);
  assert.equal(first.headers.get('Content-Range'),'bytes 0-1/10');
  assert.equal(await first.text(),'01');
  assert.equal(await (await serveMedia(store,'file',request('bytes=-3'))).text(),'789');
  assert.equal((await serveMedia(store,'file',request('bytes=10-'))).status,416);
  assert.equal((await serveMedia(store,'file',request(null,'HEAD'))).headers.get('Content-Length'),'10');
});
