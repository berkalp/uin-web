import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";

type Kind =
  | "artist" | "book" | "movie" | "series" | "game" | "place"
  | "director" | "actor" | "writer" | "comedian" | "theatre_artist"
  | "athlete" | "club" | "sport" | "hobby" | "activity";

type SearchItem = {
  provider: string;
  externalId: string;
  title: string;
  subtitle: string | null;
  creatorName: string | null;
  coverUrl: string | null;
  sourceUrl: string | null;
  metadata: Record<string, unknown>;
};

const ALLOWED = new Set<Kind>([
  "artist","book","movie","series","game","place","director","actor","writer",
  "comedian","theatre_artist","athlete","club","sport","hobby","activity"
]);

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function https(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const normalized = raw.replace(/^http:\/\//i, "https://");
  return normalized.startsWith("https://") ? normalized : null;
}

async function spotify(query: string): Promise<SearchItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("uin-spotify-search", {
    body: { query, filter: "artist" },
  });
  if (error) throw new Error(`Sanatçı araması yapılamadı: ${error.message}`);
  const envelope = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const items = Array.isArray(envelope.items) ? envelope.items : [];
  return items.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const externalId = text(row.externalId);
    const title = text(row.title);
    if (!externalId || !title) return [];
    return [{
      provider: "spotify",
      externalId,
      title,
      subtitle: text(row.subtitle),
      creatorName: text(row.creatorName),
      coverUrl: https(row.coverUrl),
      sourceUrl: https(row.sourceUrl),
      metadata: row.metadata && typeof row.metadata === "object"
        ? row.metadata as Record<string, unknown>
        : {},
    }];
  }).slice(0, 18);
}

async function igdb(query: string): Promise<SearchItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("uin-igdb-search", {
    body: { query },
  });
  if (error) throw new Error(`Oyun araması yapılamadı: ${error.message}`);
  const envelope = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const items = Array.isArray(envelope.items) ? envelope.items : [];
  return items.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const externalId = text(row.externalId) || text(row.external_id);
    const title = text(row.title);
    if (!externalId || !title) return [];
    return [{
      provider: "igdb",
      externalId,
      title,
      subtitle: text(row.subtitle),
      creatorName: text(row.creatorName) || text(row.creator_name),
      coverUrl: https(row.coverUrl) || https(row.cover_url),
      sourceUrl: https(row.sourceUrl) || https(row.source_url),
      metadata: row.metadata && typeof row.metadata === "object"
        ? row.metadata as Record<string, unknown>
        : {},
    }];
  }).slice(0, 18);
}

async function googleBooks(query: string): Promise<SearchItem[]> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", query);
  url.searchParams.set("printType", "books");
  url.searchParams.set("orderBy", "relevance");
  url.searchParams.set("maxResults", "18");

  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error("Kitap arama servisi şu anda yanıt vermiyor.");
  const payload = await response.json() as { items?: unknown[] };

  return (Array.isArray(payload.items) ? payload.items : []).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const id = text(row.id);
    const info = row.volumeInfo && typeof row.volumeInfo === "object"
      ? row.volumeInfo as Record<string, unknown>
      : {};
    const title = text(info.title);
    if (!id || !title) return [];
    const authors = Array.isArray(info.authors)
      ? info.authors.filter((value): value is string => typeof value === "string")
      : [];
    const imageLinks = info.imageLinks && typeof info.imageLinks === "object"
      ? info.imageLinks as Record<string, unknown>
      : {};

    return [{
      provider: "google_books",
      externalId: id,
      title,
      subtitle: text(info.subtitle),
      creatorName: authors.length ? authors.join(", ") : null,
      coverUrl: https(imageLinks.thumbnail) || https(imageLinks.smallThumbnail),
      sourceUrl: https(info.canonicalVolumeLink) || https(info.infoLink),
      metadata: {
        authors,
        publisher: text(info.publisher),
        published_date: text(info.publishedDate),
        language: text(info.language),
      },
    }];
  });
}

async function tvmaze(query: string): Promise<SearchItem[]> {
  const response = await fetch(
    `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`,
    { headers: { Accept: "application/json" }, cache: "no-store" }
  );
  if (!response.ok) throw new Error("Dizi arama servisi şu anda yanıt vermiyor.");
  const payload = await response.json() as unknown[];

  return (Array.isArray(payload) ? payload : []).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const wrap = raw as Record<string, unknown>;
    const show = wrap.show && typeof wrap.show === "object"
      ? wrap.show as Record<string, unknown>
      : {};
    const id = typeof show.id === "number" ? String(show.id) : text(show.id);
    const title = text(show.name);
    if (!id || !title) return [];
    const image = show.image && typeof show.image === "object"
      ? show.image as Record<string, unknown>
      : {};
    const network = show.network && typeof show.network === "object"
      ? show.network as Record<string, unknown>
      : {};
    return [{
      provider: "tvmaze",
      externalId: id,
      title,
      subtitle: text(network.name),
      creatorName: null,
      coverUrl: https(image.original) || https(image.medium),
      sourceUrl: https(show.url),
      metadata: {
        premiered: text(show.premiered),
        genres: Array.isArray(show.genres) ? show.genres : [],
      },
    }];
  }).slice(0, 18);
}

const KIND_HINTS: Record<Exclude<Kind, "artist" | "book" | "series" | "game">, string[]> = {
  movie: ["film", "movie", "sinema"],
  place: ["city", "town", "village", "district", "country", "museum", "park", "şehir", "ilçe", "ülke", "müze", "ada", "island"],
  director: ["director", "film director", "yönetmen"],
  actor: ["actor", "actress", "oyuncu"],
  writer: ["writer", "author", "novelist", "yazar", "şair", "poet"],
  comedian: ["comedian", "stand-up", "komedyen"],
  theatre_artist: ["actor", "theatre", "stage", "tiyatro"],
  athlete: ["athlete", "footballer", "player", "sporcu", "futbolcu", "basketball"],
  club: ["football club", "sports club", "team", "kulüb", "takım"],
  sport: ["sport", "spor"],
  hobby: ["hobby", "pastime", "hobi"],
  activity: ["activity", "recreation", "aktivite", "etkinlik"],
};

async function wikidata(query: string, kind: Exclude<Kind, "artist" | "book" | "series" | "game">): Promise<SearchItem[]> {
  const all: Array<Record<string, unknown>> = [];

  for (const language of ["tr", "en"]) {
    const url = new URL("https://www.wikidata.org/w/api.php");
    url.searchParams.set("action", "wbsearchentities");
    url.searchParams.set("search", query);
    url.searchParams.set("language", language);
    url.searchParams.set("uselang", "tr");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    url.searchParams.set("limit", "24");

    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "UIN/1.0 favorite-search" },
      cache: "no-store",
    });
    if (!response.ok) continue;
    const payload = await response.json() as { search?: unknown[] };
    for (const row of Array.isArray(payload.search) ? payload.search : []) {
      if (row && typeof row === "object") all.push(row as Record<string, unknown>);
    }
  }

  const seen = new Set<string>();
  const hints = KIND_HINTS[kind];

  const filtered = all.filter((row) => {
    const id = text(row.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);

    const description = `${text(row.description) ?? ""} ${text(row.label) ?? ""}`.toLocaleLowerCase("tr-TR");
    if (kind === "activity" || kind === "hobby" || kind === "sport") return true;
    return hints.some((hint) => description.includes(hint.toLocaleLowerCase("tr-TR")));
  });

  return filtered.slice(0, 18).map((row) => {
    const id = text(row.id)!;
    return {
      provider: "wikidata",
      externalId: id,
      title: text(row.label) || id,
      subtitle: text(row.description),
      creatorName: null,
      coverUrl: null,
      sourceUrl: `https://www.wikidata.org/wiki/${encodeURIComponent(id)}`,
      metadata: {
        wikidata_id: id,
        uin_item_kind: kind,
        description: text(row.description),
      },
    };
  });
}

export async function GET(request: NextRequest) {
  const kindRaw = request.nextUrl.searchParams.get("kind")?.trim() as Kind | undefined;
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";

  if (!kindRaw || !ALLOWED.has(kindRaw)) {
    return NextResponse.json({ error: "Geçersiz tür." }, { status: 400 });
  }
  if (query.length < 2) {
    return NextResponse.json({ items: [] });
  }

  try {
    let items: SearchItem[];

    if (kindRaw === "artist") items = await spotify(query);
    else if (kindRaw === "book") items = await googleBooks(query);
    else if (kindRaw === "series") items = await tvmaze(query);
    else if (kindRaw === "game") items = await igdb(query);
    else items = await wikidata(query, kindRaw);

    return NextResponse.json({ items });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Arama yapılamadı.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
