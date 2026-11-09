import { cp, mkdir } from 'node:fs/promises';
await mkdir('.pages-preview',{recursive:true});
await Promise.all([
  cp('frontend/dist','.pages-preview/dist',{recursive:true}),
  cp('functions','.pages-preview/functions',{recursive:true})
]);
console.log('Pages CLI 작업 디렉터리: .pages-preview');
