import {eligiblePlace,placeSearchClasses,possiblePlace} from "@/utils/placeSearchEligibility";
﻿import {googleBookDetails} from "@/utils/bookDetails";
import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";

type Kind =
  | "artist" | "book" | "movie" | "series" | "watch" | "game" | "place"
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
  "artist","book","movie","series","watch","game","place","director","actor","writer",
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

function possibleSport(label: string, description: string) {
  const value = `${label} ${description}`.toLocaleLowerCase("tr-TR");
  const describesSport = ["spor", "sport", "athletic", "ball game", "martial art", "physical exercise", "fitness"].some(term=>value.includes(term));
  const describesSomethingElse = ["kulüb", "club", "spor takımı", "sports team", "stadyum", "stadium", "spor sahası", "sports venue", "podcast", "video game", "oyunu serisi", " topu", "ball used", "terimleri", "language used", "birliği", "governing body", "kitap", " book", "kuralları", " rules", "lig", "league", "turnuva", "tournament", "şampiyona", "championship", "müsabaka", "competition", "sporcu", "athlete", "footballer", "basketball player", "federasyon", "federation", "organization", "organisation"].some(term=>value.includes(term));
  return describesSport && !describesSomethingElse;
}

async function spotify(query: string): Promise<SearchItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("uin-spotify-search", {
    body: { query, filter: "artist" },
    ...(process.env.SUPABASE_FUNCTION_ANON_KEY?{headers:{Authorization:"Bearer "+process.env.SUPABASE_FUNCTION_ANON_KEY}}:{}),
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
    ...(process.env.SUPABASE_FUNCTION_ANON_KEY?{headers:{Authorization:"Bearer "+process.env.SUPABASE_FUNCTION_ANON_KEY}}:{}),
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
        book_details: googleBookDetails(row),
        google_books_id: id,
        uin_item_kind: "book",
        page_count: info.pageCount,
        isbn: info.industryIdentifiers,
        categories: info.categories,
        preview_url: https(info.previewLink),
        authors,
        description: text(info.description),
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
        uin_item_kind: "series",
      },
    }];
  }).slice(0, 18);
}

const KIND_HINTS: Record<Exclude<Kind, "artist" | "series" | "watch" | "game">, string[]> = {
  book: ["book", "novel", "kitap", "roman", "literary work"],
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

async function wikidata(query: string, kind: Exclude<Kind, "artist" | "series" | "watch" | "game">): Promise<SearchItem[]> {
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
    if(kind==="place")return possiblePlace(text(row.label)||"",text(row.description)||"");
    if(kind==="sport")return possibleSport(text(row.label)||"",text(row.description)||"");
    if (kind === "activity" || kind === "hobby") return true;
    return hints.some((hint) => description.includes(hint.toLocaleLowerCase("tr-TR")));
  });

  const selected = filtered.slice(0, kind==="place"?48:12);
  const entitiesUrl = new URL("https://www.wikidata.org/w/api.php");
  entitiesUrl.searchParams.set("action", "wbgetentities");
  entitiesUrl.searchParams.set("ids", selected.map((row) => text(row.id)).filter(Boolean).join("|"));
  entitiesUrl.searchParams.set("props", "claims|sitelinks");
  entitiesUrl.searchParams.set("sitefilter", "trwiki|enwiki");
  entitiesUrl.searchParams.set("format", "json");
  entitiesUrl.searchParams.set("origin", "*");
  let entities: Record<string, Record<string, unknown>> = {};
  if (selected.length) {
    const entityResponse = await fetch(entitiesUrl, { headers: { Accept: "application/json", "User-Agent": "UIN/1.0 idea-search" }, cache: "no-store" });
    if (entityResponse.ok) {
      const entityPayload = await entityResponse.json() as { entities?: Record<string, Record<string, unknown>> };
      entities = entityPayload.entities ?? {};
    }
  }

  const placeClasses=kind==="place"?await placeSearchClasses(entities):{};
  const bookAuthors:Record<string,string>={};
  if(kind==="book"){
    const authorIds=[...new Set(Object.values(entities).flatMap(e=>((e.claims as Record<string,any>)?.P50||[]).map((c:any)=>c.mainsnak?.datavalue?.value?.id).filter(Boolean)))].slice(0,50);
    if(authorIds.length){const r=await fetch("https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels%7Csitelinks&sitefilter=trwiki%7Cenwiki&languages=tr%7Cen&ids="+authorIds.join("|"),{next:{revalidate:3600}});if(r.ok){const d=await r.json();for(const [id,e] of Object.entries(d.entities||{}) as [string,any][])bookAuthors[id]=e.labels?.tr?.value||e.labels?.en?.value||e.sitelinks?.enwiki?.title||""}}
  }
  return selected.filter(row=>kind==="place"?eligiblePlace(entities[text(row.id)!],text(row.label)||"",text(row.description)||"",placeClasses):kind!=="book"||Array.isArray((entities[text(row.id)!]?.claims as Record<string,unknown>|undefined)?.P50)).slice(0,12).map((row) => {
    const id = text(row.id)!;
    const entity = entities[id] ?? {};
    const claims = entity.claims && typeof entity.claims === "object" ? entity.claims as Record<string, unknown> : {};
    const images = Array.isArray(claims.P18) ? claims.P18 : [];
    const firstImage = images[0] && typeof images[0] === "object" ? images[0] as Record<string, unknown> : {};
    const snak = firstImage.mainsnak && typeof firstImage.mainsnak === "object" ? firstImage.mainsnak as Record<string, unknown> : {};
    const dataValue = snak.datavalue && typeof snak.datavalue === "object" ? snak.datavalue as Record<string, unknown> : {};
    const filename = text(dataValue.value);
    const sitelinks = entity.sitelinks && typeof entity.sitelinks === "object" ? entity.sitelinks as Record<string, unknown> : {};
    const trwiki = sitelinks.trwiki && typeof sitelinks.trwiki === "object" ? sitelinks.trwiki as Record<string, unknown> : {};
    const enwiki = sitelinks.enwiki && typeof sitelinks.enwiki === "object" ? sitelinks.enwiki as Record<string, unknown> : {};
    const wikiTitle = text(trwiki.title) || text(enwiki.title);
    const wikiLanguage = text(trwiki.title) ? "tr" : "en";
    return {
      provider: "wikidata",
      externalId: id,
      title: text(row.label) || id,
      subtitle: text(row.description),
      creatorName:kind==="book"?(Array.isArray(claims.P50)?claims.P50:[]).map((c:any)=>bookAuthors[c.mainsnak?.datavalue?.value?.id]).filter(Boolean).join(", ")||null:null,
      coverUrl: filename ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=900` : null,
      sourceUrl: wikiTitle ? `https://${wikiLanguage}.wikipedia.org/wiki/${encodeURIComponent(wikiTitle.replace(/ /g, "_"))}` : `https://www.wikidata.org/wiki/${encodeURIComponent(id)}`,
      metadata: {
        wikidata_id: id,
        uin_item_kind: kind,
        description: text(row.description),
        wikipedia_title: wikiTitle,
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
    else if (kindRaw === "book") {try{items=await googleBooks(query);if(!items.length)items=await wikidata(query,"book")}catch{items=await wikidata(query,"book")}}
    else if (kindRaw === "series") items = await tvmaze(query);
    else if (kindRaw === "watch") {
      const [seriesResult, movieResult] = await Promise.allSettled([
        tvmaze(query),
        wikidata(query, "movie"),
      ]);
      const combined = [
        ...(seriesResult.status === "fulfilled" ? seriesResult.value : []),
        ...(movieResult.status === "fulfilled" ? movieResult.value : []),
      ];
      const normalizedQuery = query.toLocaleLowerCase("tr-TR").trim();
      const seen = new Set<string>();
      items = combined
        .filter((item) => {
          const key = `${item.provider}:${item.externalId}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((left, right) => {
          const leftTitle = left.title.toLocaleLowerCase("tr-TR").trim();
          const rightTitle = right.title.toLocaleLowerCase("tr-TR").trim();
          return Number(rightTitle === normalizedQuery) - Number(leftTitle === normalizedQuery);
        })
        .slice(0, 18);
    }
    else if (kindRaw === "game") items = await igdb(query);
    else items = await wikidata(query, kindRaw);

    return NextResponse.json({ items });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Arama yapılamadı.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
