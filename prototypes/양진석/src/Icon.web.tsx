import React from 'react';

// Inline vectors keep controls visible even when an icon font cannot be loaded.
// No font file, private-use Unicode character, CDN, or image request is needed.
const paths:Record<string,string>={
 mic:'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5 M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3 M8 22h8',
 'book-open':'M12 5C8 2 4 3 2 3v16c4-1 7 0 10 2 3-2 6-3 10-2V3c-4-1-7 0-10 2v16',
 search:'M15.5 15.5 21 21 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
 sliders:'M4 3v5m0 4v9 M12 3v11m0 4v3 M20 3v2m0 4v12 M1 8h6v4H1z M9 14h6v4H9z M17 5h6v4h-6z',
 lock:'M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4',
 'edit-3':'M12 20h9 M4 15 16 3l5 5L9 20l-6 1 1-6 M14 5l5 5',
 clock:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2',
 'check-circle':'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M7 12l3 3 7-7',
 'alert-circle':'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 7v6 M12 17h.01',
 check:'M4 12l5 5L20 6',
 'arrow-right':'M4 12h16 M14 6l6 6-6 6',
 download:'M12 3v12 M7 10l5 5 5-5 M4 15v6h16v-6',
 upload:'M12 15V3 M7 8l5-5 5 5 M4 15v6h16v-6',
 'refresh-cw':'M21 3v6h-6 M21 9a9 9 0 1 0 0 7',
 image:'M3 3h18v18H3z M3 16l5-5 6 6 3-3 4 4 M15 8h.01',
 'trash-2':'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
 x:'M6 6l12 12 M18 6 6 18',
 square:'M5 5h14v14H5z',
 play:'M7 3l14 9-14 9V3',
 pause:'M7 4v16 M17 4v16',
};
export default function Icon({name,size=21,color='#172C20'}:{name:string;size?:number;color?:string}){
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{flexShrink:0,display:'block'}}><path d={paths[name]||paths['check-circle']}/></svg>;
}
