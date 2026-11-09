import { localDatabase } from './local-db.mjs';
import { passwordHash } from '../backend/src/security.js';
const {ADMIN_USERNAME:username,ADMIN_PASSWORD:password}=process.env;
if(!username||!/^[a-zA-Z0-9_.-]{3,80}$/.test(username)||!password||password.length<16||password.length>200||password!==password.trim()) {
  console.error('ADMIN_USERNAME 및 16~200자의 ADMIN_PASSWORD를 환경변수에 설정하세요.');
  process.exitCode=1;
} else {
  const db=await localDatabase();
  try {
    const hash=await passwordHash(password);
    await db.transaction(async()=>{
      const [account]=await db.all('SELECT id FROM accounts WHERE username=?',[username]);
      if(account) {
        await db.run('UPDATE accounts SET password_hash=? WHERE id=?',[hash,account.id]);
        await db.run('DELETE FROM sessions WHERE account_id=?',[account.id]);
      } else await db.run('INSERT INTO accounts(id,username,password_hash) VALUES(?,?,?)',[crypto.randomUUID(),username,hash]);
    });
    console.log('관리자 계정을 저장했습니다.');
  } finally {await db.close();}
}
