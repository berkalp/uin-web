"use client";
import type {IntentReactionContext} from "@/utils/intentReactions";
// Compatibility for existing detail pages; highlighting has been retired.
export default function IntentReactionBar(_props:{intentId:string;initialContext?:IntentReactionContext|null;isAuthenticated:boolean;isOwner:boolean;variant?:"card"|"detail"|"compact"}) { return null; }
