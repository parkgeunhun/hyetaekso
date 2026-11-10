import { menu } from './site-content.js';

export const defaultNavigation = menu.map(([slug, label]) => ({slug, label, visible: true}));

export function siteMenu(navigation = defaultNavigation) {
  return navigation.filter(item => item.visible).map(({slug, label}) => {
    const entry = menu.find(item => item[0] === slug);
    return [slug, label, entry[2], entry[3]];
  });
}

export function menuLabel(slug, navigation) {
  return navigation?.find(item => item.slug === slug)?.label ?? menu.find(item => item[0] === slug)?.[1];
}
