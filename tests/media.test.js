import {test} from 'node:test';
import assert from 'node:assert/strict';
import {serveMedia} from '../backend/src/media-response.js';
import {databaseMedia} from '../backend/src/media-store.js';
import {sqlite} from '../scripts/local-db.mjs';
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

test('database media preserves original bytes and ranges across parts',async()=>{
  const db=await sqlite(':memory:');
  try {
    const key=crypto.randomUUID()+'.mp4', type='video/mp4';
    const data=Buffer.alloc(650000);
    for(let i=0;i<data.length;i++)data[i]=i%251;
    await databaseMedia(db).put(key,data,{httpMetadata:{contentType:type}});
    const store=databaseMedia(db);
    const url='https://preview.example/api/media/'+key;
    const range=await serveMedia(store,key,new Request(url,{headers:{Range:'bytes=262140-262155'}}));
    assert.equal(range.status,206);
    assert.equal(range.headers.get('Content-Range'),'bytes 262140-262155/650000');
    assert.deepEqual(Buffer.from(await range.arrayBuffer()),data.subarray(262140,262156));
    assert.deepEqual((await store.get(key)).body,data);
    await assert.rejects(databaseMedia(db).put(key,Buffer.from('duplicate'),{httpMetadata:{contentType:type}}));
    assert.deepEqual((await store.get(key)).body,data);
  } finally {db.close();}
});
