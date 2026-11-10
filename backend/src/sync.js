import { activeOffers, offer, supportSignature } from './catalog.js';
import { replace, settings } from './records.js';
import { money, text } from './security.js';
import { officialRequest,fetchOfficial,parseOfficial,limitedText } from './carrier-support.js';

export const privateSupportSyncPath='/internal/support-sync';

async function prepareSupportSync(db,env) {
  const config=await settings(db);
  const rows=await activeOffers(db);
  const targets=[];
  const summary={total:rows.length,ready:0,unlinked:0,missingPlan:0,invalidMapping:0,missingFeed:0};
  for(const row of rows) {
    if(!row.source_key.trim()) {
      summary.unlinked++;
    } else if(/^(skt|smartchoice):/.test(row.source_key)) {
      if(!row.plan_source.trim()) {summary.missingPlan++;continue;}
      try {targets.push({row,official:officialRequest(row,config)});}
      catch {summary.invalidMapping++;}
    } else if(env.SUPPORT_FEED_URL) {
      targets.push({row});
    } else {
      summary.missingFeed++;
    }
  }
  summary.ready=targets.length;
  return {summary,targets};
}

export async function supportSyncStatus(db,env) {
  return (await prepareSupportSync(db,env)).summary;
}

export async function syncSupports(db,env,fetcher=fetch) {
  const now=Date.now(),expires=36*3600000;
  let report,values=[],feedUnavailable=false;
  try {
    const {summary,targets}=await prepareSupportSync(db,env);
    if(targets.some(target=>!target.official)) {
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
    let next=0,skipped=0,unavailable=0;
    await Promise.all(Array.from({length:Math.min(4,targets.length)},async()=>{
      while(next<targets.length) {
        const {row,official}=targets[next++];
        try {
          let amount,source,published=now;
          if(official) {
            const key=official.url+'\n'+(official.body??'');
            if(!officialResponses.has(key))officialResponses.set(key,fetchOfficial(official,fetcher).catch(()=>null));
            const raw=await officialResponses.get(key);
            if(raw===null){unavailable++;continue;}
            ({amount,source}=parseOfficial(row,official,raw,now));
          } else if(feedUnavailable) {
            unavailable++;continue;
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
        if(!current?.enabled||current.extra>current.price||supportSignature(current)!==supportSignature(row)){skipped++;continue;}
        await replace(db,'supports',row.id+'-feed',{offer_id:row.id,mode:'feed',amount,source,updated_at:published,expires_at:published+expires,signature:supportSignature(row)});
        changed++;
      }
    });
    const notReady=summary.total-summary.ready;
    if(!targets.length) {
      report={status:'unconfigured',message:summary.total
        ? '자동 갱신할 조건이 없습니다. '+notReady+'개 가격 조건의 공개 조회 연결을 확인해 주세요.'
        : '사용 중인 요금제에 연결된 가격 조건이 없습니다.'};
    } else {
      report={
        status:changed?(skipped||unavailable?'partial':'success'):(unavailable?'failed':'empty'),
        message:changed+'개 갱신'
          +(skipped?' · 조건 불일치 '+skipped+'개':'')
          +(unavailable?' · 출처 조회 실패 '+unavailable+'개':'')
          +(notReady?' · 연결 설정 필요 '+notReady+'개':'')
      };
    }
  } catch {report={status:'failed',message:'지원금 동기화를 완료하지 못했습니다. 기존 유효 데이터는 유지됩니다.'};}
  await db.run('INSERT INTO sync_runs(id,status,message,created_at) VALUES(?,?,?,?)',[crypto.randomUUID(),report.status,report.message,now]);
  return report;
}
export async function maintenance(db) {
  const config=await settings(db),now=Date.now();
  await db.run('DELETE FROM leads WHERE created_at<?',[now-config.retention_days*86400000]);
  await db.run('DELETE FROM sessions WHERE expires_at<?',[now]);
  await db.run('DELETE FROM rate_limits WHERE expires_at<?',[now]);
}
