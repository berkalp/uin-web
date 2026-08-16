import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HTML_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 7000;

type PreviewPayload = {
  imageUrl: string | null;
  title: string | null;
  finalUrl: string;
};

function isForbiddenIpv4(value: string) {
  const parts = value
    .split(".")
    .map((part) => Number(part));

  if (
    parts.length !== 4 ||
    parts.some(
      (part) =>
        !Number.isInteger(part) ||
        part < 0 ||
        part > 255
    )
  ) {
    return true;
  }

  const [a, b] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isForbiddenIpv6(value: string) {
  const normalized = value.toLowerCase();

  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }

  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    return isForbiddenIpv4(mapped);
  }

  return false;
}

function isForbiddenAddress(value: string) {
  const family = isIP(value);

  if (family === 4) {
    return isForbiddenIpv4(value);
  }

  if (family === 6) {
    return isForbiddenIpv6(value);
  }

  return true;
}

async function assertSafePublicHttpsUrl(url: URL) {
  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS URLs are supported.");
  }

  if (
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    throw new Error("Unsupported URL.");
  }

  const hostname = url.hostname
    .toLowerCase()
    .replace(/\.$/, "");

  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Unsupported host.");
  }

  if (isIP(hostname)) {
    if (isForbiddenAddress(hostname)) {
      throw new Error("Private network addresses are not supported.");
    }
    return;
  }

  const addresses = await lookup(hostname, {
    all: true,
    verbatim: true,
  });

  if (
    addresses.length === 0 ||
    addresses.some((entry) =>
      isForbiddenAddress(entry.address)
    )
  ) {
    throw new Error("Host does not resolve to a public address.");
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 16))
    );
}

function parseTagAttributes(tag: string) {
  const attributes = new Map<string, string>();
  const expression =
    /([A-Za-z_:][A-Za-z0-9_:\-.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

  let match: RegExpExecArray | null;

  while ((match = expression.exec(tag))) {
    const key = match[1].toLowerCase();
    const value =
      match[2] ??
      match[3] ??
      match[4] ??
      "";

    attributes.set(
      key,
      decodeHtmlEntities(value.trim())
    );
  }

  return attributes;
}

function extractMetadata(
  html: string,
  baseUrl: URL
) {
  const values = new Map<string, string>();

  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseTagAttributes(match[0]);
    const key = (
      attributes.get("property") ||
      attributes.get("name") ||
      ""
    ).toLowerCase();
    const content = attributes.get("content");

    if (key && content && !values.has(key)) {
      values.set(key, content);
    }
  }

  const imageCandidate =
    values.get("og:image:secure_url") ||
    values.get("og:image") ||
    values.get("twitter:image") ||
    values.get("twitter:image:src") ||
    null;

  let imageUrl: URL | null = null;

  if (imageCandidate) {
    try {
      imageUrl = new URL(
        imageCandidate,
        baseUrl
      );
    } catch {
      imageUrl = null;
    }
  }

  const ogTitle =
    values.get("og:title") ||
    values.get("twitter:title") ||
    null;

  const titleMatch =
    html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);

  const title =
    ogTitle ||
    (titleMatch
      ? decodeHtmlEntities(
          titleMatch[1]
            .replace(/\s+/g, " ")
            .trim()
        )
      : null);

  return {
    imageUrl,
    title,
  };
}

async function readBoundedHtml(
  response: Response
) {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let html = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    bytesRead += value.byteLength;

    if (bytesRead > MAX_HTML_BYTES) {
      await reader.cancel();
      break;
    }

    html += decoder.decode(value, {
      stream: true,
    });
  }

  html += decoder.decode();

  return html;
}

async function fetchPreview(
  initialUrl: URL
): Promise<PreviewPayload> {
  let currentUrl = initialUrl;

  for (
    let redirectCount = 0;
    redirectCount <= MAX_REDIRECTS;
    redirectCount += 1
  ) {
    await assertSafePublicHttpsUrl(currentUrl);

    const response = await fetch(currentUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(
        FETCH_TIMEOUT_MS
      ),
      headers: {
        accept:
          "text/html,application/xhtml+xml,image/avif,image/webp,image/*,*/*;q=0.8",
        "user-agent":
          "Mozilla/5.0 (compatible; UINLinkPreview/1.0; +https://uin.onl)",
      },
      cache: "no-store",
    });

    if (
      response.status >= 300 &&
      response.status < 400
    ) {
      const location = response.headers.get("location");

      if (
        !location ||
        redirectCount === MAX_REDIRECTS
      ) {
        throw new Error("Too many redirects.");
      }

      currentUrl = new URL(
        location,
        currentUrl
      );
      continue;
    }

    if (!response.ok) {
      throw new Error("Preview source could not be loaded.");
    }

    const contentType = (
      response.headers.get("content-type") ||
      ""
    ).toLowerCase();

    if (contentType.startsWith("image/")) {
      return {
        imageUrl: currentUrl.toString(),
        title: null,
        finalUrl: currentUrl.toString(),
      };
    }

    if (
      !contentType.includes("text/html") &&
      !contentType.includes(
        "application/xhtml+xml"
      )
    ) {
      return {
        imageUrl: null,
        title: null,
        finalUrl: currentUrl.toString(),
      };
    }

    const contentLength = Number(
      response.headers.get("content-length") ||
        "0"
    );

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_HTML_BYTES
    ) {
      throw new Error("Preview page is too large.");
    }

    const html = await readBoundedHtml(
      response
    );

    const metadata = extractMetadata(
      html,
      currentUrl
    );

    let imageUrl: string | null = null;

    if (metadata.imageUrl) {
      try {
        await assertSafePublicHttpsUrl(
          metadata.imageUrl
        );
        imageUrl =
          metadata.imageUrl.toString();
      } catch {
        imageUrl = null;
      }
    }

    return {
      imageUrl,
      title: metadata.title,
      finalUrl: currentUrl.toString(),
    };
  }

  throw new Error("Preview could not be resolved.");
}

export async function GET(
  request: Request
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json(
      {
        imageUrl: null,
        title: null,
        error: "Authentication required.",
      },
      {
        status: 401,
      }
    );
  }

  const requestUrl = new URL(request.url);
  const rawTarget =
    requestUrl.searchParams.get("url");

  if (!rawTarget) {
    return Response.json(
      {
        imageUrl: null,
        title: null,
        error: "URL is required.",
      },
      {
        status: 400,
      }
    );
  }

  let target: URL;

  try {
    target = new URL(rawTarget);
  } catch {
    return Response.json(
      {
        imageUrl: null,
        title: null,
        error: "Invalid URL.",
      },
      {
        status: 400,
      }
    );
  }

  try {
    const preview =
      await fetchPreview(target);

    return Response.json(
      preview,
      {
        headers: {
          "Cache-Control":
            "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch {
    return Response.json(
      {
        imageUrl: null,
        title: null,
        finalUrl: target.toString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "public, max-age=300, s-maxage=900",
        },
      }
    );
  }
}
