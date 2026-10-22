'use client';
import {useEffect,useRef,type ReactNode} from 'react';

/** One focus boundary for both the field guide and expedition report. */
export default function FocusDialog({labelledBy,className,onClose,children}:{labelledBy:string;className:string;onClose:()=>void;children:ReactNode}){
  const root=useRef<HTMLDivElement>(null);
  const close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const node=root.current;if(!node)return;
    const focusable=()=>Array.from(node.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),summary,[tabindex="0"]')).filter(el=>el.getClientRects().length>0);
    (focusable()[0]||node).focus();
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.stopPropagation();close.current();}
      if(event.key!=='Tab')return;
      const items=focusable();const first=items[0],last=items.at(-1);
      if(!first){event.preventDefault();node.focus();return;}
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===node)){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!node.contains(document.activeElement))){event.preventDefault();first.focus();}
    };
    node.addEventListener('keydown',onKey);
    return()=>{node.removeEventListener('keydown',onKey);if(previous?.isConnected)previous.focus();};
  },[]);
  return <div ref={root} className={className} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>{children}</div>;
}
