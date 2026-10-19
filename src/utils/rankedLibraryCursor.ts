import {decodeLatestLibraryCursor} from './latestLibraryCursor';
import type {LibraryFeedSort} from './libraryFeedSort';

type RankedCursor={sort:LibraryFeedSort;scope:string;value:number;tie:number;time:string;id:string};
export function decodeRankedLibraryCursor(raw:string|null,sort:LibraryFeedSort,scope:string):RankedCursor|null {
  if(raw===null)return null;
  if(raw.length>16000)throw new Error('Geçersiz sayfa.');
  const value=JSON.parse(Buffer.from(raw,'base64url').toString('utf8')) as RankedCursor;
  if(!value||value.sort!==sort||value.scope!==scope||typeof value.value!=='number'||!Number.isFinite(value.value)||value.value<0||!Number.isSafeInteger(value.tie)||value.tie<0)throw new Error('Geçersiz sayfa.');
  decodeLatestLibraryCursor(Buffer.from(JSON.stringify({time:value.time,id:value.id})).toString('base64url'));
  return value;
}
export function encodeRankedLibraryCursor(value:RankedCursor){
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
