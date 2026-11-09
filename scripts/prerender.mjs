import { createServer } from 'vite';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { menu } from '../frontend/src/pages/content.js';

const vite=await createServer({mode:'prerender',server:{middlewareMode:true,ws:false},optimizeDeps:{noDiscovery:true,include:[]},configFile:'vite.config.js'});
try {
  const {render}=await vite.ssrLoadModule('/src/entry-server.jsx');
  const template=await readFile('frontend/dist/index.html','utf8');
  await writeFile('frontend/dist/200.html',template);
  const routes=[['','생활에 필요한 혜택','휴대폰부터 인터넷·TV, 렌탈과 생활 서비스를 혜택소에서 살펴보세요.'],...menu];
  const escape=value=>value.replace(/[&<>"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[character]));
  for (const [slug,title,description] of routes) {
    const dir='frontend/dist/'+slug;await mkdir(dir,{recursive:true});
    await writeFile(dir+'/index.html',template.replace(/<title>.*?<\/title>/,'<title>'+escape(title)+' | 혜택소</title>')
      .replace(/name="description" content="[^"]+"/,'name="description" content="'+escape(description)+'"')
      .replace('<div id="root"></div>','<div id="root" data-route="/'+slug+'">'+render('/'+slug)+'</div>'));
  }
  const origin=process.env.PUBLIC_ORIGIN;
  if(origin){
    const base=new URL(origin);
    if(base.protocol!=='https:')throw new Error('PUBLIC_ORIGIN must use HTTPS');
    await writeFile('frontend/dist/sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+routes.map(([slug])=>'<url><loc>'+escape(new URL('/'+slug,base).href)+'</loc></url>').join('')+'</urlset>');
    await writeFile('frontend/dist/robots.txt','User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /lookup\nSitemap: '+new URL('/sitemap.xml',base).href+'\n');
  }
  console.log('Pre-rendered '+routes.length+' public pages');
} finally {await vite.close();}
