import { createConnection } from 'mysql2/promise';

export async function connectMysql(options) {
  if (!options) throw new Error('Missing MySQL connection binding');
  const config = typeof options === 'string' ? {uri:options} : {
    host:options.host, port:Number(options.port), user:options.user,
    password:options.password, database:options.database
  };
  const connection = await createConnection({...config, disableEval:true, connectTimeout:8000});
  return {
    async all(sql,args=[]) { const [rows]=await connection.execute(sql,args); return rows; },
    async run(sql,args=[]) { const [result]=await connection.execute(sql,args); return result; },
    async transaction(work) {
      await connection.beginTransaction();
      try { const value=await work(); await connection.commit(); return value; }
      catch(error) { await connection.rollback(); throw error; }
    },
    close:()=>connection.end()
  };
}
