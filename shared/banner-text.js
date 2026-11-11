export const maxBannerLayers = 24;
export const maxBannerText = 1000;
export const bannerIconLabels = {
  smartphone:'휴대폰', badge:'인증', headset:'상담', wrench:'설치·수리',
  wifi:'인터넷', tv:'TV', shield:'보호', gift:'혜택', percent:'할인',
  truck:'이사', home:'홈케어', car:'차량', key:'렌탈', building:'사업자',
  handshake:'제휴', heart:'보험', phone:'전화', clock:'운영 시간',
  message:'문의', check:'확인'
};
export const bannerIconShapes = {circle:'원형',rounded:'둥근 사각형',plain:'배경 없음'};
export const bannerTextAlignments = {left:'왼쪽',center:'가운데',right:'오른쪽'};

export function bannerLineBreaks(value) {
  return value.replace(/\\r\\n|\\n|\\r|\r\n?/g, '\n');
}

function layer(id, text, x, y, size, color, bold = false, heading = false) {
  return {id,text:text ?? '',x,y,size,color,bold,heading};
}

export function defaultHeroLayers(data) {
  const color = data.dark ? '#ffffff' : '#17202c';
  return [
    layer('kicker',data.kicker,5,12,20,color,true),
    layer('headline',data.title[0],5,29,58,color,true,true),
    layer('subtitle',data.title[1],5,51,54,data.dark?'#ffad22':'#a65f00',true),
    layer('description',data.description,5,75,19,color)
  ].filter(item=>item.text);
}

export function defaultSlideLayers(slide) {
  return [
    layer('headline',slide.title,5,25,54,'#ffffff',true,true),
    layer('description',slide.body,5,53,22,'#ffffff')
  ].filter(item=>item.text);
}

export function newBannerLayer(id) {
  return layer(id,'새 문구',8,14,32,'#ffffff',true);
}

export function newBannerIcon(id,icon,index) {
  return {id,type:'icon',icon,x:68+(index%3)*9,y:18+(Math.floor(index/3)%3)*23,size:52,
    color:'#17202c',background:'#ffffff',shape:'circle'};
}
