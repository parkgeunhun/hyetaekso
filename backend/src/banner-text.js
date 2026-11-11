import { bannerIconLabels, bannerIconShapes, bannerLineBreaks, bannerTextAlignments, maxBannerLayers, maxBannerText } from '../../shared/banner-text.js';
import { choice, invalid, money, text } from './security.js';

function hexColor(value,label) {
  if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value)) throw invalid(label+'을 확인해 주세요.');
  return value.toLowerCase();
}

export function validateBannerLayers(input) {
  if (input===null) return null;
  if (!Array.isArray(input)||input.length>maxBannerLayers) throw invalid('배너 요소는 최대 '+maxBannerLayers+'개까지 추가할 수 있습니다.');
  const ids = new Set();
  return input.map(item=>{
    if (!item||typeof item!=='object'||Array.isArray(item)) throw invalid('배너 요소를 확인해 주세요.');
    const id = text(item.id,'배너 요소 번호',48);
    if (!/^[a-z0-9-]+$/.test(id)||ids.has(id)) throw invalid('배너 요소 번호를 확인해 주세요.');
    ids.add(id);
    const position={x:money(item.x,'X 좌표',0,100),y:money(item.y,'Y 좌표',0,100)};
    if(item.type==='icon') {
      return {
        id,type:'icon',icon:choice(item.icon,Object.keys(bannerIconLabels),'아이콘'),...position,
        size:money(item.size,'아이콘 크기',20,160),color:hexColor(item.color,'아이콘 색상'),
        background:hexColor(item.background,'배경 색상'),shape:choice(item.shape,Object.keys(bannerIconShapes),'아이콘 배경')
      };
    }
    if(item.type!==undefined&&item.type!=='text') throw invalid('배너 요소 유형을 확인해 주세요.');
    if (typeof item.bold!=='boolean'||typeof item.heading!=='boolean') throw invalid('배너 글자 스타일을 확인해 주세요.');
    const value = text(item.text,'배너 문구',maxBannerText,false);
    return {
      id, text:bannerLineBreaks(value), color:hexColor(item.color,'글자 색상'), bold:item.bold, heading:item.heading,
      ...position,size:money(item.size,'글자 크기',10,120),
      ...(item.align===undefined?{}:{align:choice(item.align,Object.keys(bannerTextAlignments),'문구 정렬')})
    };
  });
}

export async function listBanners(db, publicOnly = false) {
  const scope = publicOnly?' WHERE b.enabled=1 ORDER BY b.sort_order,b.id LIMIT 12':' ORDER BY b.sort_order,b.id LIMIT 2000';
  const rows = await db.all('SELECT b.*, t.value AS layer_json FROM banners b LEFT JOIN banner_text t ON t.id=b.id'+scope);
  return rows.map(({layer_json,...row})=>layer_json?{...row,layers:JSON.parse(layer_json)}:row);
}
