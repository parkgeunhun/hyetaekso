import {readFile,stat} from 'node:fs/promises';
import ExcelJS from 'exceljs';
import {digest,text} from '../backend/src/security.js';
import {storageKey} from '../backend/src/catalog.js';
import {saveRecord} from '../backend/src/records.js';
import {localDatabase} from './local-db.mjs';

const headers={
  상품:['관리코드','상품명','상태','브랜드','배지','기본이미지URL','메뉴슬러그(|구분)','상담마감(0/1)','샘플(0/1)','정렬순서','상세설명HTML'],
  용량별출고가:['관리코드','용량','출고가'],
  조건:['관리코드','통신사','가입유형','용량','요금제','월요금','추가지원금'],
  색상:['관리코드','색상','이미지URL']
};
const brands={samsung:'삼성전자',apple:'애플',other:'기타'};
const key=(...values)=>'wp-'+digest(JSON.stringify(values)).slice(0,45);
const fail=message=>{throw new Error(message);};
const plain=s=>String(s).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/<\/(?:p|div|li)>|<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g,entity=>({'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"})[entity]).trim();

async function parse(filename) {
  if((await stat(filename)).size>4000000)fail('4 MB 이하의 WordPress XLSX 파일을 선택해 주세요.');
  const workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load(await readFile(filename));
  const result={};
  for(const [name,fields] of Object.entries(headers)) {
    const sheet=workbook.getWorksheet(name);
    if(!sheet||sheet.columnCount!==fields.length||sheet.rowCount>2001||fields.some((v,i)=>sheet.getCell(1,i+1).value!==v)) fail(name+' 시트의 열과 행을 확인해 주세요.');
    result[name]=[];
    sheet.eachRow((row,index)=>{
      if(index===1)return;
      const cells=fields.map((_,i)=>{
        const value=row.getCell(i+1).value??'';
        if(!['string','number'].includes(typeof value))fail(name+' '+index+'행: 수식이나 특수 셀은 사용할 수 없습니다.');
        return value;
      });
      result[name].push(cells);
    });
  }
  return {rows:result,categoryNames:new Map((workbook.getWorksheet('메뉴목록')?.getSheetValues()??[]).filter(row=>Array.isArray(row)&&typeof row[1]==='string'&&typeof row[2]==='string').map(row=>[row[2],row[1]]))};
}
async function getId(db,table,name,create=true) {
  const [row]=await db.all('SELECT id FROM '+table+' WHERE name=?',[name]);
  if(row)return row.id;
  if(!create)fail('먼저 통신사와 요금제를 등록하세요: '+name);
  const id=key(table,name);
  await saveRecord(db,table,{name},id);
  return id;
}
async function importRows(db,rows,categoryNames) {
  const products=new Map(),capacities=new Map(),duplicates=new Set();
  const reserve=(type,...fields)=>{const id=key(type,...fields);if(duplicates.has(id))fail('중복 행: '+fields.join(' / '));duplicates.add(id);return id;};
  for(const [code,name,status,brand,badge,image,slugs,closed,sample,sortOrder,description] of rows.상품) {
    text(code,'상품 관리코드',100);
    const productId=reserve('product',code);
    const manufacturer_id=await getId(db,'manufacturers',brands[brand]??String(brand||'기타'));
    const categories=[];
    for(const slug of String(slugs).split('|').map(v=>v.trim()).filter(Boolean))categories.push(await getId(db,'categories',categoryNames.get(slug)??slug));
    const content=plain(description);
    await saveRecord(db,'products',{manufacturer_id,name,description:content,image,status:status==='publish'?'published':'draft',sort_order:Number(sortOrder||0),sample:Number(sample||0),closed:Number(closed||0),categories},productId);
    products.set(code,productId);
  }
  const product=code=>products.get(code)??fail('상품 시트에 관리코드가 없습니다: '+code);
  for(const [code,storage,price] of rows.용량별출고가) {
    const normalized=storageKey(text(storage,'용량',40));
    const id=reserve('capacity',code,normalized);
    await saveRecord(db,'capacities',{product_id:product(code),name:normalized,price},id);
    capacities.set(id,true);
  }
  for(const [code,carrier,join,storage,plan,fee,extra] of rows.조건) {
    product(code);
    const capacity_id=key('capacity',code,storageKey(text(storage,'용량',40)));
    if(!capacities.has(capacity_id))fail('용량별 출고가가 없습니다: '+code+' / '+storage);
    const carrierId=await getId(db,'carriers',carrier,false);
    const plans=await db.all('SELECT id FROM plans WHERE carrier_id=? AND name=? AND fee=?',[carrierId,plan,Number(fee)]);
    if(plans.length!==1)fail('통신사·요금제명·월요금이 일치하는 요금제를 먼저 등록하세요: '+carrier+' / '+plan);
    const plan_id=plans[0].id,id=reserve('offer',capacity_id,plan_id,join);
    const [prior]=await db.all('SELECT source_key FROM offers WHERE id=?',[id]);
    await saveRecord(db,'offers',{capacity_id,plan_id,join_type:join,extra,source_key:prior?.source_key??''},id);
  }
  for(const [code,name,image] of rows.색상) {
    const id=reserve('color',code,text(name,'색상',50));
    await saveRecord(db,'colors',{product_id:product(code),name,image},id);
  }
  return Object.fromEntries(Object.entries(rows).map(([name,values])=>[name,values.length]));
}
const [, , filename,flag]=process.argv;
if(!filename||flag&&flag!=='--apply'){
  console.error('사용법: node --env-file-if-exists=.env scripts/import-wordpress-phones.mjs <기존 XLSX> [--apply]');
  process.exitCode=1;
} else {
  let db;
  try {
    const {rows,categoryNames}=await parse(filename);
    db=await localDatabase();
    const rollback=new Error('preview rollback');
    let summary;
    try {await db.transaction(async()=>{
      summary=await importRows(db,rows,categoryNames);
      if(!flag)throw rollback;
    });} catch(error){if(error!==rollback)throw error;}
    console.log(JSON.stringify({applied:!!flag,summary}));
  } catch(error){console.error('이전 검토 실패:',error.message);process.exitCode=1;}
  finally {if(db)await db.close();}
}
