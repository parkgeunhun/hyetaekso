import { offer, supportSignature } from './catalog.js';
import { replace, settings } from './records.js';
import { money, text } from './security.js';
import { officialRequest,fetchOfficial,parseOfficial,limitedText } from './carrier-support.js';

export async function syncSupports(db,env,fetcher=fetch) {
  const now=Date.now(),expires=36*3600000;
  const config=await settings(db);
  const report={status:'unconfigured',message:'지원금 피드 또는 공개 조회 연결 코드가 설정되지 않았습니다.'};
  let targets,values=[],feedUnavailable=false;
  try {
    const sources=await db.all("SELECT id FROM offers WHERE source_key<>'' ORDER BY id");
    targets=[];
    for(const target of sources) {
      const row=await offer(db,target.id);
      if(row)targets.push(row);
    }
    if(env.SUPPORT_FEED_URL) {
      try {
        const url=new URL(env.SUPPORT_FEED_URL);
        if(url.protocol!=='https:'||url.username||url.password)throw new Error('피드 주소 확인 필요');
        const data=JSON.parse(await limitedText(await fetcher(url,{signal:AbortSignal.timeout(12000),redirect:'error'})));
        if(!Array.isArray(data)||data.length>5000)throw new Error('피드 형식 오류');
        values=data;
      } catch {
        feedUnavailable=true;
      }
    }
    const officialResponses=new Map(),updates=[];
    let next=0,skipped=0;
    await Promise.all(Array.from({length:Math.min(4,targets.length)},async()=>{
      while(next<targets.length) {
        const row=targets[next++];
        try {
          let amount,source,published=now;
          if(/^(skt|smartchoice):/.test(row.source_key)) {
            const target=officialRequest(row,config),key=target.url+'\n'+(target.body??'');
            if(!officialResponses.has(key))officialResponses.set(key,fetchOfficial(target,fetcher));
            ({amount,source}=parseOfficial(row,target,await officialResponses.get(key),now));
          } else {
            const matches=values.filter(item=>item?.key===row.source_key&&item.carrier===row.carrier&&item.storage===row.storage&&item.plan===row.plan&&item.fee===row.fee&&item.join===row.join_type);
            if(matches.length!==1)throw new Error('피드 연결 조건 누락');
            const value=matches[0];
            amount=money(value.amount,'지원금',0,row.price);source=text(value.source,'출처',200);
            published=Date.parse(value.updatedAt);
            if(!Number.isFinite(published)||published>now+300000||published<=now-expires)throw new Error('피드 기준일 오류');
          }
          updates.push({row,amount,source,published});
        } catch {skipped++;}
      }
    }));
    let changed=0;
    if(updates.length)await db.transaction(async()=>{
      for(const {row,amount,source,published} of updates) {
        const current=await offer(db,row.id);
        if(!current||supportSignature(current)!==supportSignature(row)){skipped++;continue;}
        await replace(db,'supports',row.id+'-feed',{offer_id:row.id,mode:'feed',amount,source,updated_at:published,expires_at:published+expires,signature:supportSignature(row)});
        changed++;
      }
    });
    if(targets.length||env.SUPPORT_FEED_URL) {
      report.status=changed?(skipped||feedUnavailable?'partial':'success'):(feedUnavailable?'failed':'empty');
      report.message=changed+'개 조건 갱신 · '+skipped+'개 조건 보류'+(feedUnavailable?' · 지정 피드 조회 실패':'');
    }
  } catch {report.status='failed';report.message='지원금 동기화를 완료하지 못했습니다. 기존 유효 데이터는 유지됩니다.';}
  await db.run('INSERT INTO sync_runs(id,status,message,created_at) VALUES(?,?,?,?)',[crypto.randomUUID(),report.status,report.message,now]);
  return report;
}
export async function maintenance(db) {
  const config=await settings(db),now=Date.now();
  await db.run('DELETE FROM leads WHERE created_at<?',[now-config.retention_days*86400000]);
  await db.run('DELETE FROM sessions WHERE expires_at<?',[now]);
  await db.run('DELETE FROM rate_limits WHERE expires_at<?',[now]);
}
