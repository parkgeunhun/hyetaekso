import { defineConfig,loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { Readable } from 'node:stream';
import { mkdir, readFile,writeFile,stat } from 'node:fs/promises';
import { localDatabase,seedDemo } from './scripts/local-db.mjs';
import { handleApi } from './backend/src/api.js';

function localApi(env) {
  return {
    name:'hyetaekso-local-api',
    async configureServer(server) {
      const db=await localDatabase(env.DATABASE_URL??'');
      if(!env.DATABASE_URL)await seedDemo(db);
      const folder='.local/media';
      await mkdir(folder,{recursive:true});
      const types={jpg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',mp4:'video/mp4',webm:'video/webm'};
      const MEDIA={
        put:(key,bytes)=>writeFile(folder+'/'+key,bytes),
        async head(key) {
          try {return {size:(await stat(folder+'/'+key)).size,httpMetadata:{contentType:types[key.split('.').pop()]}};}
          catch(error){if(error.code==='ENOENT')return null;throw error;}
        },
        async get(key,options) {
          try { const bytes=await readFile(folder+'/'+key),range=options?.range; return {size:bytes.length,body:range?bytes.subarray(range.offset,range.offset+range.length):bytes,httpMetadata:{contentType:types[key.split('.').pop()]}}; }
          catch(error) { if(error.code==='ENOENT')return null;throw error; }
        }
      };
      let queue=Promise.resolve();
      server.middlewares.use((incoming,outgoing,next)=>{
        if(!incoming.url?.startsWith('/api/'))return next();
        const work=async()=>{
          try {
            const origin='http://'+incoming.headers.host;
            const init={method:incoming.method,headers:incoming.headers};
            if(!['GET','HEAD'].includes(init.method))Object.assign(init,{body:Readable.toWeb(incoming),duplex:'half'});
            const request=new Request(new URL(incoming.url,origin),init);
            const response=await handleApi(request,{...env,APP_ORIGIN:env.APP_ORIGIN||origin,LOCAL_DEV:true,MEDIA},db);
            outgoing.writeHead(response.status,Object.fromEntries(response.headers));
            if(response.body)Readable.fromWeb(response.body).pipe(outgoing);else outgoing.end();
          } catch {outgoing.writeHead(500);outgoing.end();}
        };
        queue=queue.then(work,work);
      });
      server.httpServer?.once('close',()=>db.close());
    }
  };
}
export default defineConfig(({mode,command})=>({
  root:'frontend',plugins:[react(),...(command==='serve'&&mode!=='prerender'?[localApi(mode==='browser-test'?{}:loadEnv(mode,process.cwd(),''))]:[])],
  server:{host:'127.0.0.1',port:5173,strictPort:true},
  build:{outDir:'dist',emptyOutDir:true}
}));
