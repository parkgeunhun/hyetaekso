const dayMs=86400000;
const koreaOffset=9*3600000;
const dayKey=time=>new Date(time+koreaOffset).toISOString().slice(0,10);

export function koreaDay(now=Date.now()) {
  const start=Math.floor((now+koreaOffset)/dayMs)*dayMs-koreaOffset;
  return {start,end:start+dayMs};
}

export async function recordPageView(db,now=Date.now()) {
  const day=dayKey(now);
  const increment=()=>db.run('UPDATE page_views_daily SET views=views+1 WHERE day=?',[day]);
  const updated=await increment();
  if(updated.affectedRows??updated.changes)return;
  try {
    await db.run('INSERT INTO page_views_daily(day,views) VALUES(?,1)',[day]);
  } catch(error) {
    if(error.code!=='ER_DUP_ENTRY'&&error.errcode!==1555)throw error;
    // Another request inserted the day's first row.
    await increment();
  }
}

export async function recentPageViews(db,now=Date.now()) {
  const {start}=koreaDay(now);
  const days=Array.from({length:30},(_,index)=>dayKey(start-(29-index)*dayMs));
  const rows=await db.all('SELECT day,views FROM page_views_daily WHERE day BETWEEN ? AND ?',[days[0],days.at(-1)]);
  const [{first_day}]=await db.all('SELECT MIN(day) AS first_day FROM page_views_daily');
  const counts=new Map(rows.map(row=>[row.day,Number(row.views)]));
  return days.map(day=>({day,views:first_day&&day>=first_day?(counts.get(day)??0):null}));
}
