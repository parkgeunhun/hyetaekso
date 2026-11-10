import { connectMysql } from './db.js';
import { handleApi,json } from './api.js';
import { maintenance,privateSupportSyncPath,syncSupports } from './sync.js';

export default {
  async fetch(request,env) {
    let db;
    try {
      if(env.HYETAEKSO_LOCAL_API) {
        const source=new URL(request.url);
        if(!source.pathname.startsWith('/api/')) return json({error:{code:'not_found'}},404);
        const target=new URL('http://127.0.0.1:8789');
        target.pathname=source.pathname;
        target.search=source.search;
        const headers=new Headers();
        for(const name of ['origin','content-type','range','cf-connecting-ip']) {
          const value=request.headers.get(name);
          if(value!==null)headers.set(name,value);
        }
        // Keep the Pages Access token at the edge; the origin only needs our session.
        const session=request.headers.get('cookie')?.match(/(?:^|;\s*)(hyetaekso_session=[a-f0-9]{64})(?:;|$)/)?.[1];
        if(session)headers.set('cookie',session);
        return await env.HYETAEKSO_LOCAL_API.fetch(new Request(target,{
          method:request.method,headers,body:request.body,duplex:'half',redirect:'manual'
        }));
      }
      db=await connectMysql(env.HYPERDRIVE);
      return await handleApi(request,env,db);
    } catch {
      return json({error:{code:'unavailable',message:'데이터베이스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'}},503);
    } finally { if(db)await db.close(); }
  },
  async scheduled(_event,env) {
    if(env.HYETAEKSO_LOCAL_API) {
      // The public proxy only forwards /api/ requests. Run just the sync on the preview DB.
      const response=await env.HYETAEKSO_LOCAL_API.fetch(new Request('http://127.0.0.1:8789'+privateSupportSyncPath,{method:'POST'}));
      if(!response.ok)throw new Error('Preview support sync returned HTTP '+response.status);
      await response.body?.cancel();
      return;
    }
    const db=await connectMysql(env.HYPERDRIVE);
    try { await maintenance(db);await syncSupports(db,env); }
    finally { await db.close(); }
  }
};
