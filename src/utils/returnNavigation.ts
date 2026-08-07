export type ReturnSearchParams = Record<
  string,
  string | string[] | undefined
>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function isSafeInternalPath(value: string | null) {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//"));
}

export function resolveReturnNavigation(
  searchParams: ReturnSearchParams,
  fallback: { href: string; label: string }
) {
  const returnTo = firstValue(searchParams.returnTo);
  const returnLabel = firstValue(searchParams.returnLabel)?.trim();

  if (isSafeInternalPath(returnTo)) {
    return {
      href: returnTo as string,
      label:
        returnLabel && returnLabel.length <= 48
          ? returnLabel
          : fallback.label,
    };
  }

  const from = firstValue(searchParams.from);
  if (from === "timeline") {
    return {
      href: "/timeline",
      label: "Timeline",
    };
  }

  return fallback;
}

export function withReturnContext(
  targetHref: string,
  returnTo: string,
  returnLabel: string,
  from?: string
) {
  const [path, existingQuery = ""] = targetHref.split("?", 2);
  const params = new URLSearchParams(existingQuery);

  if (from) {
    params.set("from", from);
  }
  params.set("returnTo", returnTo);
  params.set("returnLabel", returnLabel);

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
