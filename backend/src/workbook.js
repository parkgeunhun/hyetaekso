import ExcelJS from 'exceljs';
import { definitions, saveRecord } from './records.js';
import { invalid, digest } from './security.js';

const allowed=['manufacturers','carriers','categories','products','capacities','colors','plans','offers','supports','banners','content'];
const keys=table=>['id',...Object.keys(definitions[table]),...(table==='products'?['categories']:[])];
export async function exportWorkbook(db,table) {
  if (!allowed.includes(table)) throw invalid('엑셀 종류를 확인해 주세요.');
  const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet(table);
  const fields=keys(table);
  sheet.addRow(fields);
  const rows=await db.all('SELECT * FROM '+table+(table==='supports'?" WHERE mode='manual'":'')+' ORDER BY id LIMIT 2000');
  for (const row of rows) {
    if (table==='products') row.categories=(await db.all('SELECT category_id FROM product_categories WHERE product_id=?',[row.id])).map(item=>item.category_id).join(',');
    sheet.addRow(fields.map(key=>row[key]??''));
  }
  return workbook.xlsx.writeBuffer();
}
function verifyZip(buffer) {
  const end=buffer.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
  if (end<0||end+22>buffer.length) throw invalid('XLSX 파일을 선택해 주세요.');
  const count=buffer.readUInt16LE(end+10);
  let offset=buffer.readUInt32LE(end+16),total=0;
  if (count<1||count>100) throw invalid('엑셀 파일 구조를 확인해 주세요.');
  for (let i=0;i<count;i++) {
    if(offset+46>end||buffer.readUInt32LE(offset)!==0x02014b50) throw invalid('엑셀 파일 구조를 확인해 주세요.');
    total+=buffer.readUInt32LE(offset+24);
    offset+=46+buffer.readUInt16LE(offset+28)+buffer.readUInt16LE(offset+30)+buffer.readUInt16LE(offset+32);
    if(total>16*1024*1024) throw invalid('엑셀 압축 해제 크기가 너무 큽니다.');
  }
}
export async function workbookRows(table,base64) {
  if(!allowed.includes(table)||typeof base64!=='string'||base64.length>5500000||!(/^[a-zA-Z0-9+/=]+$/).test(base64)) throw invalid('XLSX 파일과 종류를 확인해 주세요.');
  const buffer=Buffer.from(base64,'base64');
  verifyZip(buffer);
  const workbook=new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer); } catch { throw invalid('엑셀을 읽지 못했습니다. 다운로드한 양식을 사용해 주세요.'); }
  const sheet=workbook.getWorksheet(table),fields=keys(table);
  if (!sheet || sheet.rowCount>1001 || sheet.columnCount!==fields.length || fields.some((key,index)=>sheet.getCell(1,index+1).value!==key)) throw invalid('열 이름과 행 수를 확인해 주세요. 최대 1,000행입니다.');
  const rows=[];
  sheet.eachRow((row,index)=>{
    if(index===1) return;
    const record=Object.fromEntries(fields.map((key,col)=>{
      const value=row.getCell(col+1).value??'';
      if(!['number','string'].includes(typeof value)) throw invalid(index+'행에 수식 또는 지원하지 않는 셀이 있습니다.');
      return [key,value];
    }));
    if(table==='products') record.categories=String(record.categories).split(',').map(v=>v.trim()).filter(Boolean);
    rows.push(record);
  });
  return rows;
}
export async function importWorkbook(db,table,input) {
  const rows=await workbookRows(table,input.file);
  const fingerprint=digest(JSON.stringify(rows));
  if(input.apply && input.fingerprint!==fingerprint) throw invalid('미리보기를 다시 확인해 주세요.');
  const preview=new Error('preview rollback');
  try {
    await db.transaction(async()=>{
      for(const [index,row] of rows.entries()) {
        try { await saveRecord(db,table,row,String(row.id||'')); }
        catch(error) { throw invalid((index+2)+'행: '+(error.status?error.message:'중복 값이나 연결된 항목을 확인해 주세요.')); }
      }
      if(!input.apply) throw preview;
    });
  } catch(error) { if(error!==preview) throw error; }
  return {rows:rows.length,fingerprint,applied:!!input.apply};
}
