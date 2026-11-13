import { useEffect, useRef, useState } from 'react';

const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const emptyHistory=()=>({past:[],future:[]});

export function useEditHistory(value,onChange) {
  const [history,setHistory]=useState(emptyHistory);
  const current=useRef(value),lastGroup=useRef(null);

  useEffect(()=>{
    if(same(value,current.current))return;
    current.current=value;
    lastGroup.current=null;
    setHistory(emptyHistory());
  },[value]);

  function change(next,group=null) {
    if(same(next,current.current))return;
    const previous=current.current;
    const combine=group!=null&&group===lastGroup.current;
    current.current=next;
    lastGroup.current=group;
    setHistory(prior=>({past:combine?prior.past:[...prior.past,previous].slice(-50),future:[]}));
    onChange(next);
  }

  function undo() {
    if(!history.past.length)return;
    const next=history.past.at(-1),previous=current.current;
    current.current=next;
    lastGroup.current=null;
    setHistory({past:history.past.slice(0,-1),future:[previous,...history.future]});
    onChange(next);
  }

  function redo() {
    if(!history.future.length)return;
    const next=history.future[0],previous=current.current;
    current.current=next;
    lastGroup.current=null;
    setHistory({past:[...history.past,previous],future:history.future.slice(1)});
    onChange(next);
  }

  return {change,undo,redo,canUndo:history.past.length>0,canRedo:history.future.length>0};
}
