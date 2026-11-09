import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {Readable} from 'node:stream';
import {sqlite,seedDemo} from './local-db.mjs';
import {handleApi} from '../backend/src/api.js';
import {matchesPassword,passwordHash} from '../backend/src/security.js';
import {localMedia} from './local-media.mjs';

const previewBuild=process.env.HYETAEKSO_PREVIEW_BUILD;
const port=previewBuild?4174:5175;
const root=resolve(previewBuild||'frontend/dist'),origin='http://127.0.0.1:'+port;
const shell=await readFile(resolve(root,'200.html'));
const db=await sqlite(previewBuild?'.local/admin-preview.sqlite':':memory:');
const MEDIA=await localMedia(previewBuild?'.local/admin-preview-media':undefined);
await seedDemo(db);
const username=previewBuild?'admin':'browser-admin';
const password=previewBuild?process.env.HYETAEKSO_PREVIEW_PASSWORD:process.env.BROWSER_TEST_PASSWORD;
if(password) {
  await db.transaction(async()=>{
    const [account]=await db.all('SELECT id,password_hash FROM accounts WHERE username=?',[username]);
    if(!account) {
      await db.run('INSERT INTO accounts(id,username,password_hash) VALUES(?,?,?)',[crypto.randomUUID(),username,await passwordHash(password)]);
    } else if(!await matchesPassword(password,account.password_hash)) {
      await db.run('UPDATE accounts SET password_hash=? WHERE id=?',[await passwordHash(password),account.id]);
      await db.run('DELETE FROM sessions WHERE account_id=?',[account.id]);
    }
  });
}
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
          const response=await handleApi(new Request(url,options),{APP_ORIGIN:origin,LOCAL_DEV:true,MEDIA},db);
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
server.listen(port,'127.0.0.1',()=>{if(previewBuild)console.log('Admin preview: '+origin+'/admin');});
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>server.close(()=>db.close()));
