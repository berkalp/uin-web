"use client";
import {createContext, useContext} from 'react';
export type LibraryAudience = 'everyone' | 'friends' | 'me';
export type AudienceRow = {scope:'wishes'|'plans'|'experiences';target_id:string;user_ids:string[];event_ids:string[];content_type_ids:string[]};
export const LibraryAudienceContext=createContext<{audience:LibraryAudience;section:string;rows:AudienceRow[]}|null>(null);
export const useLibraryAudience=()=>useContext(LibraryAudienceContext);
