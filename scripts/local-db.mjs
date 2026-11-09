import { DatabaseSync } from 'node:sqlite';
import { mkdirSync,readFileSync,readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { connectMysql } from '../backend/src/db.js';
import { replace,saveRecord,saveSettings } from '../backend/src/records.js';

export async function applySchema(db) {
  const schema=new URL('../database/schema.sql',import.meta.url);
  const migrations=new URL('../database/migrations/',import.meta.url);
  async function execute(file) {
    for(const statement of readFileSync(file,'utf8').split(';').map(value=>value.trim()).filter(Boolean)) await db.run(statement);
  }
  await execute(schema);
  for(const filename of readdirSync(migrations).filter(name=>name.endsWith('.sql')).sort()) {
    if((await db.all('SELECT id FROM schema_migrations WHERE id=?',[filename])).length) continue;
    await execute(new URL(filename,migrations));
    await db.run('INSERT INTO schema_migrations(id) VALUES(?)',[filename]);
  }
}
export async function sqlite(path='.local/hyetaekso.sqlite') {
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
  const connection=new DatabaseSync(path);
  connection.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
  const db={
    all:async(sql,args=[])=>connection.prepare(sql).all(...args),
    run:async(sql,args=[])=>connection.prepare(sql).run(...args),
    async transaction(work) {
      connection.exec('BEGIN IMMEDIATE');
      try {const result=await work();connection.exec('COMMIT');return result;}
      catch(error) {connection.exec('ROLLBACK');throw error;}
    },
    close:()=>connection.close()
  };
  await applySchema(db);
  return db;
}
export async function localDatabase(url=process.env.DATABASE_URL) {
  return url?connectMysql(url):sqlite(process.env.LOCAL_DB_PATH);
}
export async function seedDemo(db) {
  if((await db.all("SELECT id FROM settings WHERE id='local_seed'")).length)return;
  await db.transaction(async()=>{
    await saveRecord(db,'manufacturers',{name:'삼성전자'},'samsung');
    await saveRecord(db,'manufacturers',{name:'애플'},'apple');
    await saveRecord(db,'categories',{name:'신제품'},'new');
    for(const [id,name] of [['skt','SKT'],['kt','KT'],['lgu','LGU+']]) {
      await saveRecord(db,'carriers',{name},id);
      await saveRecord(db,'plans',{carrier_id:id,name:'5G 예시 요금제',fee:69000,enabled:1},id+'-5g');
    }
    const models=['갤럭시 S26','갤럭시 S26+','갤럭시 S26 Ultra','아이폰 17','아이폰 17 Pro','아이폰 17 Pro Max','갤럭시 Z 플립','갤럭시 Z 폴드'];
    for(const [i,name] of models.entries()) {
      const id='demo-'+i;
      await saveRecord(db,'products',{manufacturer_id:name.startsWith('아이폰')?'apple':'samsung',name,description:'로컬 테스트를 위한 예시 상품입니다. 실제 판매 조건과 다릅니다.',image:'/media/phone-'+i%4+'.svg',status:'published',sample:1,sort_order:i,categories:['new']},id);
      await saveRecord(db,'capacities',{product_id:id,name:'256GB',price:1200000+i*100000},id+'-256');
      await saveRecord(db,'colors',{product_id:id,name:'기본색',image:'/media/phone-'+i%4+'.svg'},id+'-color');
      for(const carrier of ['skt','kt','lgu']) for(const [index,join_type] of ['기기변경','신규가입','번호이동'].entries()) {
        await saveRecord(db,'offers',{capacity_id:id+'-256',plan_id:carrier+'-5g',join_type,extra:150000+index*50000},id+'-'+carrier+'-'+index);
      }
    }
    await saveRecord(db,'content',{kind:'faq',category:'통신',title:'휴대폰 견적은 어떻게 계산하나요?',body:'선택한 요금제와 용량, 가입 유형에 따라 예상 금액을 확인할 수 있습니다.',status:'published'},'demo-faq');
    await saveSettings(db,{company:'혜택소',intake:1,privacy:'로컬 시험용 안내입니다. 실제 개인정보를 입력하지 마세요.',consent:'시험 데이터로 상담 저장을 확인하는 데 동의합니다.'});
    await replace(db,'settings','local_seed',{value:'true'});
  });
}
