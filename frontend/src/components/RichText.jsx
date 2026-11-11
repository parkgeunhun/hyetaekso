import { Fragment } from 'react';

const heading=/^(#{1,3})\s+(.+)$/;
const bullet=/^[-*]\s+(.+)$/;
const numbered=/^(\d+)\.\s+(.+)$/;
const linkPattern=/^\[([^\]]+)\]\(([^\s)]+)\)$/;

function safeLink(url) {
  return !/[\s\\\u0000-\u001f]/.test(url)&&/^(?:https:\/\/[^/]|mailto:[^@\s]+@[^@\s]+|\/(?!\/))/i.test(url);
}

function inline(text) {
  return text.split(/(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^\s)]+\))/g).map((part,index)=>{
    const link=part.match(linkPattern);
    if(link&&safeLink(link[2]))return <a key={index} href={link[2]}>{inline(link[1])}</a>;
    if(part.startsWith('**')&&part.endsWith('**')&&part.length>4)return <strong key={index}>{part.slice(2,-2)}</strong>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export const hasDocumentTitle=text=>/^#\s+\S/m.test(text??'');

export function RichText({text='',minHeading=2,className=''}) {
  const blocks=[];
  for(const line of text.split(/\r?\n/)) {
    if(!line.trim()){blocks.push(null);continue;}
    const title=line.match(heading),item=line.match(bullet),number=line.match(numbered);
    const previous=blocks.at(-1);
    if(title)blocks.push({kind:'h',level:Math.max(minHeading,title[1].length),text:title[2]});
    else if(item||number){
      const kind=item?'ul':'ol',value=item?.[1]??number[2];
      if(previous?.kind===kind)previous.items.push(value);
      else blocks.push({kind,items:[value],start:number?Number(number[1]):undefined});
    } else if(previous?.kind==='p')previous.text+='\n'+line;
    else blocks.push({kind:'p',text:line});
  }
  return <div className={'rich-text '+className}>{blocks.map((block,index)=>{
    if(!block)return null;
    if(block.items){
      const Tag=block.kind;
      return <Tag key={index} start={block.start}>{block.items.map((item,i)=><li key={i}>{inline(item)}</li>)}</Tag>;
    }
    const Tag=block.kind==='h'?'h'+block.level:'p';
    return <Tag key={index}>{inline(block.text)}</Tag>;
  })}</div>;
}
