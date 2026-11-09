import { serveMedia } from './media-response.js';
import { ApiError, invalid, digest, token, matchesPassword, cookie, accountSession, requireOrigin, rateLimit, readJson, text, choice } from './security.js';
import { listProducts, product, quote } from './catalog.js';
import { definitions, saveRecord, settings, saveSettings } from './records.js';
import { lookupLead, submitLead, updateLead } from './leads.js';
import { syncSupports } from './sync.js';

export const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const notFound=()=>new ApiError(404,'not_found','페이지나 데이터를 찾을 수 없습니다.');
const kinds=['notice','faq','review','qna','rental','page'];
const sessionSeconds=8*3600;
const body=async(request,limit)=>{
  const input=await readJson(request,limit);
  if(!input||typeof input!=='object'||Array.isArray(input)) throw invalid('입력값을 확인해 주세요.');
  return input;
};
async function dashboard(db) {
  const leads=await db.all('SELECT status,COUNT(*) AS count FROM leads GROUP BY status');
  const [products]=await db.all("SELECT COUNT(*) AS count FROM products WHERE status='published'");
  const [overdue]=await db.all("SELECT COUNT(*) AS count FROM leads WHERE status='접수완료' AND created_at<?",[Date.now()-86400000]);
  const [sync]=await db.all('SELECT status,message,created_at FROM sync_runs ORDER BY created_at DESC LIMIT 1');
  return {leads,products:products.count,overdue:overdue.count,sync};
}
async function media(request,env) {
  if(!env.MEDIA) throw new ApiError(503,'media_unavailable','미디어 저장소 연결이 필요합니다.');
  const contentType=request.headers.get('content-type');
  const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm'};
  const extension=types[contentType],limit=contentType?.startsWith('video/')?24*1024*1024:8*1024*1024;
  if(!extension||!request.body) throw invalid('JPG·PNG·WebP·GIF 또는 MP4·WebM 파일을 선택해 주세요.');
  const reader=request.body.getReader(),parts=[];
  let size=0;
  for(;;) {
    const {value,done}=await reader.read();if(done)break;
    size+=value.length;
    if(size>limit) {await reader.cancel();throw new ApiError(413,'too_large','파일 크기 제한을 넘었습니다.');}
    parts.push(value);
  }
  const bytes=Buffer.concat(parts);
  const signature={
    jpg:bytes[0]===255&&bytes[1]===216&&bytes[2]===255,
    png:bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a',
    gif:/^GIF8[79]a/.test(bytes.subarray(0,6).toString()),
    webp:bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP',
    mp4:bytes.subarray(4,8).toString()==='ftyp',webm:bytes.subarray(0,4).toString('hex')==='1a45dfa3'
  };
  if(!signature[extension]) throw invalid('파일의 실제 형식을 확인해 주세요.');
  const key=crypto.randomUUID()+'.'+extension;
  await env.MEDIA.put(key,bytes,{httpMetadata:{contentType}});
  return json({url:'/api/media/'+key},201);
}
export async function handleApi(request,env,db) {
  const {pathname,searchParams}=new URL(request.url),method=request.method;
  const [,prefix,area,action,id,extra]=pathname.split('/');
  try {
    if(prefix!=='api'||extra)throw notFound();
    if(method!=='GET'&&method!=='HEAD')requireOrigin(request,env);
    if(area==='media'&&['GET','HEAD'].includes(method)&&/^[a-f0-9-]{36}\.(jpg|png|webp|gif|mp4|webm)$/.test(action??'')) {
      const response=env.MEDIA&&await serveMedia(env.MEDIA,action,request);
      if(!response)throw notFound();
      return response;
    }
    if(area==='site'&&method==='GET') return json({settings:await settings(db),banners:await db.all('SELECT * FROM banners WHERE enabled=1 ORDER BY sort_order,id LIMIT 12')});
    if(area==='products'&&method==='GET') {
      if(action) return json(await product(db,action));
      return json({items:await listProducts(db),categories:await db.all('SELECT * FROM categories ORDER BY name'),links:await db.all(`SELECT pc.* FROM product_categories pc JOIN products p ON p.id=pc.product_id WHERE p.status='published'`)});
    }
    if(area==='content'&&method==='GET') {
      const kind=choice(action,kinds,'게시판');
      return json(await db.all("SELECT * FROM content WHERE kind=? AND status='published' ORDER BY created_at DESC LIMIT 200",[kind]));
    }
    if(area==='content'&&method==='POST'&&['qna','review'].includes(action)) {
      await rateLimit(db,request,'board',6,3600000);
      const input=await body(request);
      await saveRecord(db,'content',{kind:action,title:input.title,body:input.body,status:'draft'});
      return json({message:'검토 후 공개됩니다.'},201);
    }
    if(area==='quote'&&method==='POST') return json(await quote(db,await body(request)));
    if(area==='consultations'&&method==='POST') return json(action==='lookup'?await lookupLead(db,request,await body(request)):await submitLead(db,request,await body(request)),action==='lookup'?200:201);
    if(area!=='admin') throw notFound();
    if(action==='login'&&method==='POST') {
      await rateLimit(db,request,'login',8,900000);
      const input=await body(request,4000);
      const username=text(input.username,'아이디',80),password=text(input.password,'비밀번호',200);
      const [account]=await db.all('SELECT id,username,password_hash FROM accounts WHERE username=?',[username]);
      if(!await matchesPassword(password,account?.password_hash)) throw new ApiError(401,'invalid_credentials','아이디와 비밀번호를 확인해 주세요.');
      const previous=await accountSession(request,db);
      if(previous) await db.run('DELETE FROM sessions WHERE id=?',[previous.id]);
      const session=token();
      await db.run('INSERT INTO sessions(id,account_id,expires_at) VALUES(?,?,?)',[digest(session),account.id,Date.now()+sessionSeconds*1000]);
      return json({username:account.username},200,{'Set-Cookie':cookie(session,sessionSeconds,env)});
    }
    const session=await accountSession(request,db);
    if(!session) throw new ApiError(401,'login_required','관리자 로그인이 필요합니다.');
    if(action==='logout'&&method==='POST') {
      await db.run('DELETE FROM sessions WHERE id=?',[session.id]);
      return json({ok:true},200,{'Set-Cookie':cookie('',0,env)});
    }
    if(action==='session'&&method==='GET')return json({username:session.username});
    if(action==='dashboard'&&method==='GET')return json(await dashboard(db));
    if(action==='media'&&method==='POST')return await media(request,env);
    if(action==='settings') {
      if(method==='GET')return json(await settings(db));
      if(method==='PUT')return json(await db.transaction(async()=>saveSettings(db,await body(request))));
    }
    if(action==='sync') {
      if(method==='GET')return json(await db.all('SELECT * FROM sync_runs ORDER BY created_at DESC LIMIT 30'));
      if(method==='POST')return json(await syncSupports(db,env));
    }
    if(action==='leads') {
      if(method==='GET'&&id) {
        const [row]=await db.all('SELECT * FROM leads WHERE id=?',[id]);if(!row)throw notFound();return json(row);
      }
      if(method==='GET') {
        const state=searchParams.get('status'), query=searchParams.get('q')?.slice(0,100)??'';
        const page=Math.max(0,Math.min(100000,Number.parseInt(searchParams.get('page')??'0',10)||0));
        const clauses=[],args=[];
        if(state){clauses.push('status=?');args.push(state);}
        if(query){clauses.push('(receipt LIKE ? OR name LIKE ? OR phone LIKE ?)');args.push(...Array(3).fill('%'+query+'%'));}
        const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
        // mysql2 sends JS numbers as DOUBLE in prepared statements; MySQL 8.4
        // rejects that type for OFFSET. This literal is a clamped integer.
        const rows=await db.all('SELECT id,receipt,service,name,phone,status,created_at FROM leads'+where+' ORDER BY created_at DESC LIMIT 51 OFFSET '+String(page*50),args);
        return json({items:rows.slice(0,50),more:rows.length>50});
      }
      if(method==='PATCH'&&id)return json(await updateLead(db,id,await body(request)));
      if(method==='DELETE'&&id){await db.run('DELETE FROM leads WHERE id=?',[id]);return json({ok:true});}
    }
    if(action==='excel'&&id) {
      const {exportWorkbook,importWorkbook}=await import('./workbook.js');
      if(method==='GET')return new Response(await exportWorkbook(db,id),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="hyetaekso-'+id+'.xlsx"','Cache-Control':'no-store'}});
      if(method==='POST')return json(await importWorkbook(db,id,await body(request,5600000)));
    }
    if(!Object.hasOwn(definitions,action))throw notFound();
    if(method==='GET') {
      if(action==='products') {
        const rows=await db.all('SELECT * FROM products ORDER BY sort_order,name LIMIT 2000');
        const links=await db.all('SELECT * FROM product_categories');
        return json(rows.map(row=>({...row,categories:links.filter(link=>link.product_id===row.id).map(link=>link.category_id)})));
      }
      return json(await db.all('SELECT * FROM '+action+' ORDER BY id LIMIT 2000'));
    }
    if(method==='POST'||(method==='PUT'&&id)) {
      const input=await body(request);
      return json(await db.transaction(()=>saveRecord(db,action,input,id)),method==='POST'?201:200);
    }
    if(method==='DELETE'&&id){await db.run('DELETE FROM '+action+' WHERE id=?',[id]);return json({ok:true});}
    throw notFound();
  } catch(error) {
    if(error instanceof ApiError)return json({error:{code:error.code,message:error.message}},error.status);
    if(/constraint|duplicate|foreign key/i.test(error.message??'')) return json({error:{code:'conflict',message:'중복되거나 연결된 데이터가 있어 저장할 수 없습니다.'}},409);
    console.error('API failure',error.name,error.code??'');
    return json({error:{code:'server_error',message:'처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'}},500);
  }
}
