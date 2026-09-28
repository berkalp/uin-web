"use client";
import CanonicalTargetPeople from "@/components/seeds/CanonicalTargetPeople";
import TargetHighlight from "@/components/cards/TargetHighlight";
import type { SeedReactionContext } from "@/utils/seeds";

export default function SeedReactionBar({ seedId, variant = "card", seedTypeName, seedTypeSlug }: {
  seedId: string; initialContext?: SeedReactionContext | null; isAuthenticated: boolean; isOwner: boolean;
  variant?: "card" | "detail" | "compact" | "toolbar"; seedTypeName?: string | null; seedTypeSlug?: string | null;
}) {
  return <div className={variant === "toolbar" ? "flex flex-wrap items-center gap-2" : "space-y-2"}>
    <CanonicalTargetPeople seedId={seedId} seedType={`${seedTypeSlug || ""} ${seedTypeName || ""}`} compact={variant === "toolbar"} />
    <TargetHighlight seedId={seedId} />
  </div>;
}
