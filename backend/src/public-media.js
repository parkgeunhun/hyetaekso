import { appearance } from './appearance.js';
import { mediaId } from './media-store.js';

export async function isPublishedMedia(db,key,origin) {
  const matches=value=>{
    if(!value)return false;
    try {
      const url=new URL(value,origin);
      return url.origin===origin&&mediaId(url.href)===key;
    } catch {return false;}
  };
  // An upload alone is not publication. Only customer-visible references allow guest access.
  const references=await db.all(`SELECT image AS url FROM products WHERE status='published' AND image<>''
    UNION ALL SELECT c.image FROM colors c JOIN products p ON p.id=c.product_id WHERE p.status='published' AND c.image<>''
    UNION ALL SELECT image FROM banners WHERE enabled=1 AND image<>''
    UNION ALL SELECT mobile FROM banners WHERE enabled=1 AND mobile<>''
    UNION ALL SELECT link FROM banners WHERE enabled=1 AND link<>''
    UNION ALL SELECT image FROM content WHERE status='published' AND image<>''`);
  if(references.some(({url})=>matches(url)))return true;
  return Object.values(await appearance(db)).some(value=>matches(value.image)||matches(value.mobile));
}
