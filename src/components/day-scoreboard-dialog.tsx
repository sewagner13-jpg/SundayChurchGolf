"use client";
import {useEffect,useRef,type ReactNode} from "react";
export function DayScoreboardDialog({children,onClose}:{children:ReactNode;onClose:()=>void}) {
 const root=useRef<HTMLDivElement>(null);const close=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;document.body.style.overflow="hidden";close.current?.focus();
   function key(event:KeyboardEvent){if(event.key==="Escape"){event.preventDefault();onClose();}if(event.key==="Tab"){const elements=[...root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],[tabindex="0"]') ?? []];const first=elements[0],last=elements.at(-1);if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}}}
   document.addEventListener("keydown",key);return()=>{document.body.style.overflow=overflow;document.removeEventListener("keydown",key);if(previous?.isConnected)previous.focus();};
 },[onClose]);
 return <div ref={root} role="dialog" aria-modal="true" aria-labelledby="day-scoreboard-title" className="fixed inset-0 z-[70] overflow-y-auto overflow-x-hidden bg-gray-50"><div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-white px-4 py-3"><h2 id="day-scoreboard-title" className="text-lg font-bold">Full-day scoreboard</h2><button ref={close} onClick={onClose} className="min-h-11 rounded-lg border px-3 font-semibold" aria-label="Close scoreboard">Close</button></div><div className="mx-auto min-w-0 max-w-5xl p-3 pb-12 sm:p-6">{children}</div></div>;
}
