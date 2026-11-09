import { applySchema,localDatabase } from './local-db.mjs';
const db=await localDatabase();
try {await applySchema(db);console.log('스키마 확인 완료');}
finally {await db.close();}
