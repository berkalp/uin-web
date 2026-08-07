import CommunityContextChip from "@/components/communities/CommunityContextChip";
import type { IntentCommunityContext } from "@/utils/communities";

export default function CommunityContextList({
  communities,
  variant = "hero",
}: {
  communities: IntentCommunityContext[];
  variant?: "hero" | "card" | "light";
}) {
  if (communities.length === 0) return null;

  const visible = communities
    .slice()
    .sort((left, right) => left.position - right.position)
    .slice(0, 3);

  return (
    <div
      className={`flex min-w-0 flex-wrap items-center gap-2 ${
        variant === "card" ? "mt-2" : "mt-3"
      }`}
    >
      {visible.map((community, index) => (
        <CommunityContextChip
          key={`${community.intentId}-${community.id}`}
          community={community}
          compact={variant === "card" || index > 0}
          tone={
            variant === "hero" ||
            variant === "card"
              ? "overlay"
              : "surface"
          }
          className={
            variant === "hero" || variant === "card"
              ? `max-w-full backdrop-blur-md ${
                  index === 0
                    ? "ring-1 ring-white/60"
                    : ""
                }`
              : "max-w-full bg-white"
          }
        />
      ))}
    </div>
  );
}
