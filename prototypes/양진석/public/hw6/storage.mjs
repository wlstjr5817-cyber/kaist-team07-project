import {createLibrary} from './library.mjs';
const library=createLibrary({indexedDB,testing:new URLSearchParams(location.search).has('test')});
export const list=library.list;
export const save=library.save;
