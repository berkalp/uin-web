import {
  getIntentLinkLabel,
  type IntentLinkView,
} from "@/utils/intentLinks";

function getLinkClasses(
  linkType: IntentLinkView["linkType"]
) {
  if (
    linkType ===
      "ticket"
  ) {
    return "border-green-200 bg-green-50 text-green-800 hover:border-green-400 hover:bg-green-100";
  }

  if (
    linkType ===
      "official_event"
  ) {
    return "border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-400 hover:bg-blue-100";
  }

  if (
    linkType ===
      "organizer"
  ) {
    return "border-purple-200 bg-purple-50 text-purple-800 hover:border-purple-400 hover:bg-purple-100";
  }

  if (
    linkType ===
      "venue"
  ) {
    return "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-400 hover:bg-amber-100";
  }

  return "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-400 hover:bg-gray-100";
}

export default function IntentLinksDisplay({
  links,
  compact = false,
  showHeading = false,
  maxItems,
  emptyLabel,
  singleLine = false,
}: {
  links: IntentLinkView[];
  compact?: boolean;
  showHeading?: boolean;
  maxItems?: number;
  emptyLabel?: string;
  singleLine?: boolean;
}) {
  if (
    links.length ===
    0
  ) {
    return emptyLabel ? (
      <p className="truncate text-[11px] font-medium text-gray-400">
        {emptyLabel}
      </p>
    ) : null;
  }

  const visibleLinks =
    typeof maxItems === "number"
      ? links.slice(
          0,
          Math.max(
            0,
            maxItems
          )
        )
      : links;

  const remainingCount =
    Math.max(
      links.length -
        visibleLinks.length,
      0
    );

  return (
    <section className="min-w-0">
      {showHeading && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Related links
        </p>
      )}

      <div
        className={
          singleLine
            ? "flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden"
            : "flex flex-wrap gap-2"
        }
      >
        {visibleLinks.map(
          (link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={`inline-flex min-w-0 items-center gap-1.5 rounded-xl border font-semibold transition ${getLinkClasses(
                link.linkType
              )} ${
                compact
                  ? "px-3 py-2 text-[11px]"
                  : "px-4 py-2.5 text-sm"
              } ${
                singleLine
                  ? "max-w-[180px] shrink-0"
                  : ""
              }`}
            >
              <span className="truncate">
                {getIntentLinkLabel({
                  linkType:
                    link.linkType,
                  label:
                    link.label ??
                    "",
                })}
              </span>

              <span
                aria-hidden="true"
                className="shrink-0"
              >
                ↗
              </span>
            </a>
          )
        )}

        {remainingCount > 0 && (
          <span className="inline-flex shrink-0 items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-bold text-gray-500">
            +{remainingCount}
          </span>
        )}
      </div>
    </section>
  );
}
