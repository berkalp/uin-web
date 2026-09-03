import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";

type Kind =
  | "artist" | "book" | "movie" | "series" | "game" | "place"
  | "director" | "actor" | "writer" | "comedian" | "theatre_artist"
  | "athlete" | "club" | "sport" | "hobby" | "activity";

type Body = {
  kind?: Kind;
  title?: string;
  subtitle?: string | null;
  creatorName?: string | null;
  coverUrl?: string | null;
  sourceUrl?: string | null;
  metadata?: Record<string, unknown>;
};

const ALLOWED = new Set<Kind>([
  "artist","book","movie","series","game","place","director","actor","writer",
  "comedian","theatre_artist","athlete","club","sport","hobby","activity"
]);

function patternForKind(kind: Kind): RegExp {
  if (kind === "movie" || kind === "series" || kind === "director" || kind === "actor") return /watch|izle/;
  if (kind === "artist") return /listen|dinle/;
  if (kind === "book" || kind === "writer") return /read|oku/;
  if (kind === "game") return /play|oyna/;
  if (kind === "place" || kind === "club") return /visit|git|ziyaret/;
  return /try|do|make|dene|yap|learn|öğren|practice|pratik/;
}

function itemKindFor(kind: Kind): string {
  switch (kind) {
    case "book": return "book";
    case "movie": return "movie";
    case "series": return "series";
    case "artist": return "artist";
    case "game": return "game";
    case "place": return "place";
    case "director": return "director";
    case "actor": return "actor";
    case "writer": return "writer";
    case "comedian": return "comedian";
    case "theatre_artist": return "theatre_artist";
    case "athlete": return "athlete";
    case "club": return "club";
    case "sport": return "sport";
    case "hobby": return "hobby";
    case "activity": return "activity";
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Body;
    const kind = body.kind;
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!kind || !ALLOWED.has(kind) || !title) {
      return NextResponse.json({ error: "Deneyim bilgisi eksik." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });
    }

    const { data: seedTypes, error: seedTypeError } = await supabase.rpc("get_active_seed_types");
    if (seedTypeError) {
      return NextResponse.json({ error: seedTypeError.message }, { status: 500 });
    }

    const pattern = patternForKind(kind);
    const rows = Array.isArray(seedTypes) ? seedTypes : [];
    const selected = rows.find((row: unknown) => {
      if (!row || typeof row !== "object") return false;
      const item = row as Record<string, unknown>;
      const slug = typeof item.slug === "string" ? item.slug : "";
      const name = typeof item.name === "string" ? item.name : "";
      return pattern.test(`${slug} ${name}`.toLocaleLowerCase("tr-TR"));
    }) as Record<string, unknown> | undefined;

    const fallback = rows[0] as Record<string, unknown> | undefined;
    const seedTypeId =
      typeof selected?.id === "string"
        ? selected.id
        : typeof fallback?.id === "string"
          ? fallback.id
          : "";

    if (!seedTypeId) {
      return NextResponse.json({ error: "Uygun deneyim türü bulunamadı." }, { status: 500 });
    }

    const metadata = {
      ...(body.metadata && typeof body.metadata === "object" ? body.metadata : {}),
      ...(body.sourceUrl ? { reference_url: body.sourceUrl } : {}),
      uin_item_kind: itemKindFor(kind),
    };

    const { data: catalogItemId, error: catalogueError } = await supabase.rpc(
      "suggest_seed_catalog_item",
      {
        p_seed_type_id: seedTypeId,
        p_item_kind: itemKindFor(kind),
        p_canonical_title: title,
        p_creator_name: body.creatorName || body.subtitle || null,
        p_original_title: null,
        p_release_year: null,
        p_cover_url: body.coverUrl || null,
        p_language_code: null,
        p_metadata: metadata,
      }
    );

    if (catalogueError || typeof catalogItemId !== "string") {
      return NextResponse.json(
        { error: catalogueError?.message || "Deneyim konusu oluşturulamadı." },
        { status: 500 }
      );
    }

    const { data: seedId, error: plantError } = await supabase.rpc("plant_seed_from_catalog", {
      p_catalog_item_id: catalogItemId,
      p_visibility: "everyone",
      p_note: null,
      p_target_date: null,
      p_custom_title: null,
      p_catalog_edition_id: null,
      p_inspired_by_seed_id: null,
    });

    if (plantError || typeof seedId !== "string") {
      return NextResponse.json(
        { error: plantError?.message || "Deneyim kaydı oluşturulamadı." },
        { status: 500 }
      );
    }

    const { error: stateError } = await supabase.rpc("save_my_seed_v17_state", {
      p_seed_id: seedId,
      p_relationship_status: "completed",
      p_experience_precision: "unknown",
      p_experience_date: null,
      p_experience_year: null,
      p_personal_cover_url: null,
      p_rating: null,
    });

    if (stateError) {
      return NextResponse.json({ error: stateError.message }, { status: 500 });
    }

    return NextResponse.json({ seedId });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Deneyime eklenemedi.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
