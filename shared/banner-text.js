export const maxBannerLayers = 12;
export const maxBannerText = 1000;

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
