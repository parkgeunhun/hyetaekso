import { menu, pages } from './site-content.js';

export const defaultBrandImage = '/media/logo.svg';

export const homeHero = {
  dark: true,
  kicker: '좋은 혜택이 모이는 곳',
  title: ['휴대폰 구매, 고민 끝!', '혜택은 혜택소에서'],
  description: '휴대폰부터 인터넷·TV, 가전렌탈, 홈·공간 서비스까지. 일상에 필요한 혜택을 한곳에서 살펴보세요.',
  primary: '빠른 상담 신청',
  secondary: '가맹점 창업 문의'
};

export const homePromises = [
  ['신뢰할 수 있는 상담', 'Handshake', 4],
  ['안심할 수 있는 서비스', 'ShieldCheck', 8],
  ['빠른 고객 지원', 'Headset', 7]
];

export const serviceCardTile = (slug, data, index) =>
  slug === 'business' ? [1, 7, 6, 2, 4, 0][index] :
  slug === 'insurance' ? [8, 7, 5, 8, 4][index] : data.tile;

export const heroSlot = slug => slug + '-hero';
export const cardSlot = (slug, index) => slug + '-card-' + (index + 1);

function hero(slug, group, data) {
  const fields = [
    ['kicker', '윗 문구', data.kicker, 100],
    ['headline', '제목 첫 줄', data.title[0], 160],
    ['subtitle', '제목 둘째 줄', data.title[1], 160],
    ['description', '설명', data.description, 1000]
  ];
  data.features?.forEach((value, index) => fields.push(['feature' + index, '특징 ' + (index + 1), value, 100]));
  if (data.section) fields.push(['section', '서비스 목록 제목', data.section, 160]);
  data.steps?.forEach((value, index) => fields.push(['step' + index, '진행 단계 ' + (index + 1), value, 100]));
  if (slug === 'home') {
    fields.push(['primary', '상담 버튼 문구', data.primary, 50], ['secondary', '가맹 안내 버튼 문구', data.secondary, 50]);
  }
  return {
    key: heroSlot(slug),
    group,
    label: slug === 'home' ? '기본 홈 배너' : '상단 배너',
    path: slug === 'home' ? '/' : '/' + slug,
    tile: data.tile,
    hero: data,
    image: slug === 'home' ? '/media/showroom.png' : '',
    mobile: true,
    fields
  };
}

export const appearanceSlots = [
  {key: 'logo', group: '공통', label: '헤더·푸터 로고', path: '/', image: defaultBrandImage},
  {key: 'favicon', group: '공통', label: '브라우저 탭 아이콘', path: '/', image: defaultBrandImage},
  hero('home', '홈', homeHero),
  ...homePromises.map(([label, , tile], index) => ({
    key: cardSlot('home', index), group: '홈', label, path: '/', tile,
    fields: [['title', '카드 제목', label, 160], ['description', '설명', '서비스에 맞는 조건과 이용 방법을 안내합니다.', 1000]]
  })),
  ...menu.flatMap(([slug, name]) => {
    const data = pages[slug];
    const slots = [hero(slug, name, data)];
    if (slug === 'about') slots.push({key: 'about-company', group: name, label: '회사 소개 사진', path: '/about', tile: 0});
    data.cards?.forEach(([label, , detail, secondary], index) => {
      slots.push({
        key: cardSlot(slug, index), group: name, label, path: '/' + slug,
        tile: serviceCardTile(slug, data, index), textOnly: slug === 'about',
        fields: [['title', '카드 제목', label, 160], ['description', '설명', detail, 1000], ['secondary', '추가 안내', secondary, 400]]
      });
    });
    return slots;
  })
];

export const appearanceSlotByKey = new Map(appearanceSlots.map(slot => [slot.key, slot]));

export function heroAppearance(data, values = {}) {
  return {
    ...data,
    kicker: values.kicker ?? data.kicker,
    title: [values.headline ?? data.title[0], values.subtitle ?? data.title[1]],
    description: values.description ?? data.description,
    layers: values.layers,
    features: data.features?.map((label, index) => values['feature' + index] ?? label).filter(Boolean),
    section: values.section ?? data.section,
    steps: data.steps?.map((label, index) => values['step' + index] ?? label).filter(Boolean),
    primary: values.primary ?? data.primary,
    secondary: values.secondary ?? data.secondary
  };
}
