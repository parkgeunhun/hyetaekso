import { Buffer } from 'node:buffer';
import { createConnection, raw } from 'mysql2/promise';

function textProtocolValue(value) {
  if (Buffer.isBuffer(value)) {
    return raw("X'"+value.toString('hex')+"'");
  }
  if (typeof value === 'string') {
    return raw("CONVERT(X'"+Buffer.from(value,'utf8').toString('hex')+"' USING utf8mb4)");
  }
  if (value === null || typeof value === 'boolean' || Number.isFinite(value)) return value;
  throw new TypeError('Unsupported MySQL query parameter');
}

export async function connectMysql(options) {
  if (!options) throw new Error('Missing MySQL connection binding');
  const config = typeof options === 'string' ? {uri:options} : {
    host:options.host, port:Number(options.port), user:options.user,
    password:options.password, database:options.database
  };
  const connection = await createConnection({...config, disableEval:true, connectTimeout:8000});
  // Hyperdrive uses MySQL's text protocol. Encode strings and binary data as hex literals.
  const query = typeof options === 'string'
    ? (sql,args) => connection.execute(sql,args)
    : (sql,args) => connection.query(sql,args.map(textProtocolValue));
  return {
    async all(sql,args=[]) { const [rows]=await query(sql,args); return rows; },
    async run(sql,args=[]) { const [result]=await query(sql,args); return result; },
    async transaction(work) {
      await connection.beginTransaction();
      try { const value=await work(); await connection.commit(); return value; }
      catch(error) { await connection.rollback(); throw error; }
    },
    close:()=>connection.end()
  };
}
