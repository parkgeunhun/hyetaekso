import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {Readable} from 'node:stream';
import {sqlite,seedDemo} from './local-db.mjs';
import {handleApi} from '../backend/src/api.js';
import {passwordHash} from '../backend/src/security.js';

const root=resolve('frontend/dist'),origin='http://127.0.0.1:5175';
const shell=await readFile(resolve(root,'200.html'));
const db=await sqlite(':memory:');
await seedDemo(db);
if(process.env.BROWSER_TEST_PASSWORD)await db.run('INSERT INTO accounts(id,username,password_hash) VALUES(?,?,?)',['browser-admin','browser-admin',await passwordHash(process.env.BROWSER_TEST_PASSWORD)]);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain; charset=utf-8'};
let queue=Promise.resolve();
const server=createServer(async(incoming,outgoing)=>{
  try {
    const url=new URL(incoming.url,origin);
    if(url.pathname.startsWith('/api/')) {
      const work=async()=>{
        try {
          const options={method:incoming.method,headers:incoming.headers};
          if(!['GET','HEAD'].includes(options.method))Object.assign(options,{body:Readable.toWeb(incoming),duplex:'half'});
          const response=await handleApi(new Request(url,options),{APP_ORIGIN:origin,LOCAL_DEV:true},db);
          outgoing.writeHead(response.status,Object.fromEntries(response.headers));
          outgoing.end(Buffer.from(await response.arrayBuffer()));
        } catch {outgoing.writeHead(500).end();}
      };
      queue=queue.then(work,work);
      return;
    }
    const filepath=resolve(root,'.'+decodeURIComponent(url.pathname));
    if(filepath!==root&&!filepath.startsWith(root+sep)){outgoing.writeHead(404).end();return;}
    const target=extname(filepath)?filepath:resolve(filepath,'index.html');
    const file=await readFile(target).catch(error=>error.code==='ENOENT'&&!extname(filepath)?shell:null);
    if(!file){outgoing.writeHead(404).end();return;}
    outgoing.writeHead(200,{'Content-Type':types[extname(target)]??'application/octet-stream'}).end(file);
  } catch {outgoing.writeHead(500).end();}
});
server.listen(5175,'127.0.0.1');
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>server.close(()=>db.close()));
