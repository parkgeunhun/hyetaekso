import { connectMysql } from './db.js';
import { handleApi,json } from './api.js';
import { maintenance,syncSupports } from './sync.js';

export default {
  async fetch(request,env) {
    let db;
    try {
      db=await connectMysql(env.HYPERDRIVE);
      return await handleApi(request,env,db);
    } catch {
      return json({error:{code:'unavailable',message:'데이터베이스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'}},503);
    } finally { if(db)await db.close(); }
  },
  async scheduled(_event,env) {
    const db=await connectMysql(env.HYPERDRIVE);
    try { await maintenance(db);await syncSupports(db,env); }
    finally { await db.close(); }
  }
};
