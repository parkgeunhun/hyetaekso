import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
export const digest = value => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('hex');
export class ApiError extends Error {
  constructor(status,code,message) { super(message); this.status=status; this.code=code; }
}
export const invalid = message => new ApiError(400,'invalid_input',message);
export function text(value,label,max=160,required=true) {
  if (typeof value!=='string' || value.length>max || (required&&!value.trim())) throw invalid(label+'을(를) 확인해 주세요.');
  return value.trim();
}
export function money(value,label,min=0,max=100000000) {
  if (typeof value!=='number' && (typeof value!=='string'||!/^\d+$/.test(value))) throw invalid(label+'을(를) 확인해 주세요.');
  const amount=Number(value);
  if (!Number.isSafeInteger(amount)||amount<min||amount>max) throw invalid(label+'을(를) 확인해 주세요.');
  return amount;
}
export function choice(value,allowed,label) {
  if (!allowed.includes(value)) throw invalid(label+'을(를) 확인해 주세요.');
  return value;
}
export function mediaUrl(value,external=true) {
  const input=text(value??'','주소',1000,false);
  if (!input || /^\/(?!\/)[^\\\s]*$/.test(input)) return input;
  if (external) {
    try { const url=new URL(input); if (url.protocol==='https:'&&!url.username&&!url.password) return url.href; } catch {}
  }
  throw invalid('HTTPS 주소나 사이트 내부 경로를 입력해 주세요.');
}
export async function passwordHash(password,salt=randomBytes(16).toString('hex')) {
  const key=await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  return salt+':'+Buffer.from(key).toString('hex');
}
export async function matchesPassword(password,saved) {
  const valid=typeof saved==='string'&&/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(saved);
  const expected=valid?saved:'0'.repeat(32)+':'+ '0'.repeat(128);
  const actual=await passwordHash(password,expected.split(':')[0]);
  return timingSafeEqual(Buffer.from(actual),Buffer.from(expected)) && valid;
}
export function cookie(value,seconds,env) {
  return 'hyetaekso_session='+value+'; Path=/api; HttpOnly; SameSite=Strict; Max-Age='+seconds+(env.LOCAL_DEV?'':'; Secure');
}
export async function accountSession(request,db) {
  const key=request.headers.get('cookie')?.match(/(?:^|;\s*)hyetaekso_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!key) return null;
  return (await db.all('SELECT s.id, a.username FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.id=? AND s.expires_at>?',[digest(key),Date.now()]))[0]??null;
}
export function requireOrigin(request,env) {
  if (!env.APP_ORIGIN || request.headers.get('origin')!==env.APP_ORIGIN) throw new ApiError(403,'origin','이 사이트에서 요청을 다시 시작해 주세요.');
}
export async function rateLimit(db,request,scope,limit,windowMs) {
  const now=Date.now();
  const address=request.headers.get('cf-connecting-ip') || 'local';
  const key=digest(scope+'|'+address+'|'+Math.floor(now/windowMs));
  const expires=(Math.floor(now/windowMs)+1)*windowMs;
  try { await db.run('INSERT INTO rate_limits(id,hits,expires_at) VALUES(?,?,?)',[key,1,expires]); }
  catch(error) {
    if (!['ER_DUP_ENTRY','ERR_SQLITE_ERROR'].includes(error.code)) throw error;
    const result=await db.run('UPDATE rate_limits SET hits=hits+1 WHERE id=?',[key]);
    if (!(result.affectedRows??result.changes)) throw error;
  }
  const [row]=await db.all('SELECT hits FROM rate_limits WHERE id=?',[key]);
  if (row.hits>limit) throw new ApiError(429,'rate_limit','요청이 많습니다. 잠시 후 다시 시도해 주세요.');
}
export async function readJson(request,limit=256000) {
  const reader=request.body?.getReader();
  if (!reader) throw invalid('입력값을 확인해 주세요.');
  const decoder=new TextDecoder();
  let size=0, body='';
  for (;;) {
    const {value,done}=await reader.read();
    if (done) break;
    size+=value.length;
    if (size>limit) { await reader.cancel(); throw new ApiError(413,'too_large','파일 또는 입력 내용이 너무 큽니다.'); }
    body+=decoder.decode(value,{stream:true});
  }
  try { return JSON.parse(body+decoder.decode()); } catch { throw invalid('입력 형식을 확인해 주세요.'); }
}
