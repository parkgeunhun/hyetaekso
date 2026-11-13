import { activeOffers, offer, supportSignature } from './catalog.js';
import { replace, settings } from './records.js';
import { money, text } from './security.js';
import { officialRequest,fetchOfficial,parseOfficial,limitedText } from './carrier-support.js';

export const privateSupportSyncPath='/internal/support-sync';

async function prepareSupportSync(db,env) {
  const config=await settings(db);
  const rows=await activeOffers(db);
  const targets=[],issues=[];
  const summary={total:0,ready:0,unlinked:0,missingPlan:0,invalidMapping:0,missingFeed:0,samples:0,closed:0};
  for(const row of rows) {
    if(row.sample){summary.samples++;continue;}
    if(row.closed){summary.closed++;continue;}
    summary.total++;
    const issue=message=>issues.push(syncIssue(row,message));
    if(!row.source_key.trim()) {
      summary.unlinked++;issue('공식 단말 연결이 없습니다. 아래 공식 상품 연결에서 휴대폰과 요금제를 선택해 주세요.');
    } else if(/^(skt|smartchoice):/.test(row.source_key)) {
      if(!row.plan_source.trim()) {summary.missingPlan++;issue('공식 요금제 연결이 없습니다.');continue;}
      try {targets.push({row,official:officialRequest(row,config)});}
      catch {summary.invalidMapping++;issue('단말 연결 형식 또는 통신사가 맞지 않습니다.');}
    } else if(env.SUPPORT_FEED_URL) {
      targets.push({row});
    } else {
      summary.missingFeed++;issue('별도 지원금 피드가 설정되지 않았습니다. 공식 상품 연결을 이용하거나 피드를 설정해 주세요.');
    }
  }
  summary.ready=targets.length;
  return {summary,targets,issues};
}

function syncIssue(row,message) {
  return {offerId:row.id,product:row.product_name,storage:row.storage,carrier:row.carrier,plan:row.plan,join:row.join_type,message:String(message).slice(0,240)};
}

export async function supportSyncStatus(db,env) {
  const {summary,issues}=await prepareSupportSync(db,env);
  return {...summary,issues:issues.slice(0,100)};
}

export async function syncHistory(db) {
  const rows=await db.all('SELECT r.*,d.value AS details FROM sync_runs r LEFT JOIN sync_run_details d ON d.run_id=r.id ORDER BY r.created_at DESC LIMIT 30');
  return rows.map(({details,...row})=>({...row,...(details?JSON.parse(details):{})}));
}

export async function syncSupports(db,env,fetcher=fetch) {
  const now=Date.now(),expires=36*3600000;
  let report,values=[],feedUnavailable=false,issues=[],counts={};
  try {
    const prepared=await prepareSupportSync(db,env),{summary,targets}=prepared;
    issues=prepared.issues;counts={...summary,updated:0,unavailable:0,mismatched:0};
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
            if(raw===null){unavailable++;issues.push(syncIssue(row,'공식 조회 연결에 실패했습니다. 기존 유효 지원금은 유지됩니다.'));continue;}
            ({amount,source}=parseOfficial(row,official,raw,now));
          } else if(feedUnavailable) {
            unavailable++;issues.push(syncIssue(row,'지원금 피드를 읽지 못했습니다. 기존 유효 지원금은 유지됩니다.'));continue;
          } else {
            const matches=values.filter(item=>item?.key===row.source_key&&item.carrier===row.carrier&&item.storage===row.storage&&item.plan===row.plan&&item.fee===row.fee&&item.join===row.join_type);
            if(matches.length!==1)throw new Error('피드 연결 조건 누락');
            const value=matches[0];
            amount=money(value.amount,'지원금',0,row.price);source=text(value.source,'출처',200);
            published=Date.parse(value.updatedAt);
            if(!Number.isFinite(published)||published>now+300000||published<=now-expires)throw new Error('피드 기준일 오류');
          }
          updates.push({row,amount,source,published});
        } catch(error) {skipped++;issues.push(syncIssue(row,error instanceof SyntaxError?'공식 응답 형식이 바뀌었습니다.':error.message));}
      }
    }));
    let changed=0;
    if(updates.length)await db.transaction(async()=>{
      for(const {row,amount,source,published} of updates) {
        const current=await offer(db,row.id);
        if(!current?.enabled||current.sample||current.closed||current.extra>current.price||supportSignature(current)!==supportSignature(row)){skipped++;issues.push(syncIssue(row,'갱신 중 가격 조건이 바뀌었습니다. 다시 갱신해 주세요.'));continue;}
        await replace(db,'supports',row.id+'-feed',{offer_id:row.id,mode:'feed',amount,source,updated_at:published,expires_at:published+expires,signature:supportSignature(row)});
        changed++;
      }
    });
    const notReady=summary.total-summary.ready;
    if(!targets.length) {
      report={status:summary.total?'unconfigured':'waiting',message:summary.total
        ? '자동 갱신할 조건이 없습니다. '+notReady+'개 가격 조건의 공개 조회 연결을 확인해 주세요.'
        : '갱신할 실제 상품이 없습니다. 전시 예시·마감 상품은 자동 갱신에서 제외합니다.'};
    } else {
      report={
        status:changed?(skipped||unavailable||notReady?'partial':'success'):(unavailable?'failed':'empty'),
        message:changed+'개 갱신'
          +(skipped?' · 조건 불일치 '+skipped+'개':'')
          +(unavailable?' · 출처 조회 실패 '+unavailable+'개':'')
          +(notReady?' · 연결 설정 필요 '+notReady+'개':'')
      };
    }
    counts={...counts,updated:changed,unavailable,mismatched:skipped};
  } catch {report={status:'failed',message:'지원금 동기화를 완료하지 못했습니다. 기존 유효 데이터는 유지됩니다.'};}
  const id=crypto.randomUUID(),details={counts,issues:issues.slice(0,100)};
  await db.transaction(async()=>{
    await db.run('INSERT INTO sync_runs(id,status,message,created_at) VALUES(?,?,?,?)',[id,report.status,report.message,now]);
    await db.run('INSERT INTO sync_run_details(run_id,value) VALUES(?,?)',[id,JSON.stringify(details)]);
  });
  return {...report,...details};
}
export async function maintenance(db) {
  const config=await settings(db),now=Date.now();
  await db.run('DELETE FROM leads WHERE created_at<?',[now-config.retention_days*86400000]);
  await db.run('DELETE FROM sessions WHERE expires_at<?',[now]);
  await db.run('DELETE FROM rate_limits WHERE expires_at<?',[now]);
}
