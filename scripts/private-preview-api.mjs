import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {connectMysql} from '../backend/src/db.js';
import {handleApi,json} from '../backend/src/api.js';
import {localMedia} from './local-media.mjs';

const {DATABASE_URL,PREVIEW_APP_ORIGIN,SUPPORT_FEED_URL}=process.env;
const origin=new URL(PREVIEW_APP_ORIGIN||'https://hyetaekso.pages.dev');
const database=new URL(DATABASE_URL||'mysql://');
if(database.protocol!=='mysql:'||!['localhost','127.0.0.1','[::1]'].includes(database.hostname)||origin.protocol!=='https:'||origin.href!==origin.origin+'/') {
  throw new Error('A loopback MySQL URL and an HTTPS preview origin are required.');
}
const startup=await connectMysql(DATABASE_URL);
try { await startup.all('SELECT 1'); } finally { await startup.close(); }
const env={APP_ORIGIN:origin.origin,SUPPORT_FEED_URL,MEDIA:await localMedia('.local/private-preview-media')};
const server=createServer(async(incoming,outgoing)=>{
  let db;
  try {
    const url=new URL(incoming.url,origin);
    if(url.origin!==origin.origin||!url.pathname.startsWith('/api/')) {
      outgoing.writeHead(404).end();return;
    }
    const options={method:incoming.method,headers:incoming.headers};
    if(!['GET','HEAD'].includes(options.method))Object.assign(options,{body:Readable.toWeb(incoming),duplex:'half'});
    db=await connectMysql(DATABASE_URL);
    const response=await handleApi(new Request(url,options),env,db);
    const headers=Object.fromEntries(response.headers);
    if(response.headers.has('set-cookie'))headers['set-cookie']=response.headers.getSetCookie();
    outgoing.writeHead(response.status,headers);
    if(response.body&&incoming.method!=='HEAD')await pipeline(Readable.fromWeb(response.body),outgoing);
    else outgoing.end();
  } catch(error) {
    if(outgoing.destroyed)return;
    if(outgoing.headersSent){outgoing.destroy();return;}
    console.error('Private preview request failed',error.code??error.name);
    const response=json({error:{code:'unavailable',message:'미리보기 API에 연결할 수 없습니다.'}},503);
    outgoing.writeHead(response.status,Object.fromEntries(response.headers)).end(await response.text());
  } finally { if(db)await db.close().catch(()=>{}); }
});
server.listen(8789,'127.0.0.1',()=>console.log('Private preview API is ready on 127.0.0.1:8789.'));
