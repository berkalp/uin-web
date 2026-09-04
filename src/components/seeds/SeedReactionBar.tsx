"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/utils/supabase/client";
import type { SeedReactionContext } from "@/utils/seeds";

type PersonRow = {
  user_id?: string;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  seed_id?: string;
  rating?: number | null;
};

type DiscoveryRow = {
  intent_people_count?: number | string | null;
  experience_people_count?: number | string | null;
  like_count?: number | string | null;
  viewer_liked?: boolean | null;
  viewer_can_like?: boolean | null;
};

type SeedReactionBarProps = {
  seedId: string;
  initialContext?: SeedReactionContext | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  variant?: "card" | "detail" | "compact" | "toolbar";
  seedTypeName?: string | null;
  seedTypeSlug?: string | null;
};

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function copyForSeed(name?: string | null, slug?: string | null) {
  const value = `${slug ?? ""} ${name ?? ""}`.toLocaleLowerCase("tr-TR");

  if (value.includes("watch") || value.includes("izle")) {
    return {
      want: "İzlemek istiyorum",
      intent: "İzlemek isteyenler",
      experience: "İzleyenler",
    };
  }

  if (value.includes("read") || value.includes("oku")) {
    return {
      want: "Okumak istiyorum",
      intent: "Okumak isteyenler",
      experience: "Okuyanlar",
    };
  }

  if (value.includes("listen") || value.includes("dinle")) {
    return {
      want: "Dinlemek istiyorum",
      intent: "Dinlemek isteyenler",
      experience: "Dinleyenler",
    };
  }

  if (
    value.includes("visit") ||
    value.includes("ziyaret") ||
    value.includes("git")
  ) {
    return {
      want: "Gitmek istiyorum",
      intent: "Gitmek isteyenler",
      experience: "Gidenler",
    };
  }

  if (value.includes("play") || value.includes("oyna")) {
    return {
      want: "Oynamak istiyorum",
      intent: "Oynamak isteyenler",
      experience: "Oynayanlar",
    };
  }

  if (value.includes("learn") || value.includes("öğren")) {
    return {
      want: "Öğrenmek istiyorum",
      intent: "Öğrenmek isteyenler",
      experience: "Öğrenenler",
    };
  }

  if (value.includes("practice") || value.includes("pratik")) {
    return {
      want: "Pratik yapmak istiyorum",
      intent: "Pratik yapmak isteyenler",
      experience: "Pratik yapanlar",
    };
  }

  if (value.includes("try") || value.includes("dene")) {
    return {
      want: "Denemek istiyorum",
      intent: "Denemek isteyenler",
      experience: "Deneyenler",
    };
  }

  return {
    want: "Yapmak istiyorum",
    intent: "Yapmak isteyenler",
    experience: "Yapanlar",
  };
}

export default function SeedReactionBar({
  seedId,
  isAuthenticated,
  isOwner,
  variant = "card",
  seedTypeName,
  seedTypeSlug,
}: SeedReactionBarProps) {
  const copy = useMemo(
    () => copyForSeed(seedTypeName, seedTypeSlug),
    [seedTypeName, seedTypeSlug]
  );

  const [intentCount, setIntentCount] = useState(0);
  const [experienceCount, setExperienceCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [canLike, setCanLike] = useState(false);
  const [working, setWorking] = useState(false);

  const [peopleOpen, setPeopleOpen] = useState<"intent" | "experience" | null>(
    null
  );
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [people, setPeople] = useState<PersonRow[]>([]);

  useEffect(() => {
    let alive = true;

    void supabase
      .rpc("get_discoverable_seed_detail_v29", {
        p_source_seed_id: seedId,
      })
      .then(({ data, error }) => {
        if (!alive || error) return;

        const raw = Array.isArray(data) ? data[0] : data;
        if (!raw || typeof raw !== "object") return;

        const row = raw as DiscoveryRow;

        setIntentCount(numberValue(row.intent_people_count));
        setExperienceCount(numberValue(row.experience_people_count));
        setLikeCount(numberValue(row.like_count));
        setLiked(row.viewer_liked === true);
        setCanLike(row.viewer_can_like === true);
      });

    return () => {
      alive = false;
    };
  }, [seedId]);

  async function openPeople(group: "intent" | "experience") {
    setPeopleOpen(group);
    setPeopleLoading(true);
    setPeople([]);

    const { data, error } = await supabase.rpc(
      "get_personal_subject_people_v30",
      {
        p_source_seed_id: seedId,
        p_group: group,
        p_limit: 100,
      }
    );

    if (!error && Array.isArray(data)) {
      setPeople(data as PersonRow[]);

      const uniqueCount = new Set(
        data
          .map((row) =>
            row && typeof row === "object"
              ? String((row as PersonRow).user_id ?? "")
              : ""
          )
          .filter(Boolean)
      ).size;

      if (group === "intent") setIntentCount(uniqueCount);
      else setExperienceCount(uniqueCount);
    }

    setPeopleLoading(false);
  }

  async function toggleHighlight() {
    if (
      working ||
      isOwner ||
      !isAuthenticated ||
      !canLike
    ) {
      return;
    }

    setWorking(true);

    const { data, error } = await supabase.rpc(
      "set_my_personal_intent_like_v28",
      {
        p_seed_id: seedId,
        p_active: !liked,
      }
    );

    if (!error) {
      const raw = Array.isArray(data) ? data[0] : data;

      if (raw && typeof raw === "object") {
        const row = raw as {
          like_count?: number | string | null;
          viewer_liked?: boolean | null;
        };

        setLikeCount(numberValue(row.like_count));
        setLiked(row.viewer_liked === true);
      }
    }

    setWorking(false);
  }

  const audience =
    variant === "toolbar" ? (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => void openPeople("intent")}
          title={copy.intent}
          aria-label={`${copy.intent}: ${intentCount}`}
          className="inline-flex h-8 min-w-10 items-center justify-center gap-1 rounded-xl bg-green-50 px-2 text-[11px] font-black text-green-800 transition hover:bg-green-100"
        >
          <span aria-hidden="true">🌱</span>
          <span>{intentCount}</span>
        </button>

        <button
          type="button"
          onClick={() => void openPeople("experience")}
          title={copy.experience}
          aria-label={`${copy.experience}: ${experienceCount}`}
          className="inline-flex h-8 min-w-10 items-center justify-center gap-1 rounded-xl bg-emerald-50 px-2 text-[11px] font-black text-emerald-800 transition hover:bg-emerald-100"
        >
          <span aria-hidden="true">✓</span>
          <span>{experienceCount}</span>
        </button>
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void openPeople("intent")}
          className="rounded-xl bg-gray-50 px-3 py-2.5 text-left transition hover:bg-green-50"
        >
          <span className="block truncate text-[9px] font-semibold text-gray-500">
            {copy.intent}
          </span>
          <span className="mt-0.5 block text-sm font-black text-gray-950">
            {intentCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => void openPeople("experience")}
          className="rounded-xl bg-gray-50 px-3 py-2.5 text-left transition hover:bg-purple-50"
        >
          <span className="block truncate text-[9px] font-semibold text-gray-500">
            {copy.experience}
          </span>
          <span className="mt-0.5 block text-sm font-black text-gray-950">
            {experienceCount}
          </span>
        </button>
      </div>
    );
  if (variant === "toolbar") {
    return (
      <>
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {audience}

          <button
            type="button"
            onClick={() => void toggleHighlight()}
            disabled={working || isOwner || !canLike}
            title="Öne çıkar"
            className={`inline-flex h-8 min-w-10 items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-black transition ${
              liked
                ? "bg-violet-50 text-violet-700"
                : "bg-gray-50 text-gray-500"
            } disabled:cursor-default`}
          >
            ✨ {likeCount}
          </button>
        </div>

        {peopleOpen && (
          <PeopleModal
            title={
              peopleOpen === "intent"
                ? copy.intent
                : copy.experience
            }
            loading={peopleLoading}
            people={people}
            onClose={() => setPeopleOpen(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        className={
          variant === "detail"
            ? "rounded-3xl border border-gray-200 bg-white p-5"
            : ""
        }
      >
        <p className="mb-2 text-sm font-black text-gray-950">
          🌿 {copy.want}
        </p>

        {audience}

        <button
          type="button"
          onClick={() => void toggleHighlight()}
          disabled={working || isOwner || !canLike}
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition ${
            liked
              ? "border border-violet-200 bg-violet-50 text-violet-700"
              : "border border-gray-200 bg-white text-gray-600 hover:border-violet-200 hover:text-violet-700"
          } disabled:cursor-default`}
        >
          <span>{liked ? "✨" : "✧"}</span>
          <span>{liked ? "Öne çıkarıldı" : "Öne çıkar"}</span>
          <span className="rounded-full bg-black/5 px-2 py-0.5">
            {likeCount}
          </span>
        </button>
      </div>

      {peopleOpen && (
        <PeopleModal
          title={
            peopleOpen === "intent"
              ? copy.intent
              : copy.experience
          }
          loading={peopleLoading}
          people={people}
          onClose={() => setPeopleOpen(null)}
        />
      )}
    </>
  );
}

function PeopleModal({
  title,
  loading,
  people,
  onClose,
}: {
  title: string;
  loading: boolean;
  people: PersonRow[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/45 p-4 sm:items-center">
      <button
        type="button"
        aria-label="Kapat"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section className="relative z-10 max-h-[75vh] w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="font-black text-gray-950">{title}</h3>
            <p className="mt-1 text-xs text-gray-500">
              Herkese açık kayıtlar
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl bg-gray-100 font-black text-gray-700"
          >
            ×
          </button>
        </header>

        <div className="max-h-[60vh] overflow-y-auto px-5">
          {loading ? (
            <p className="py-10 text-center text-sm font-semibold text-gray-400">
              Yükleniyor…
            </p>
          ) : people.length === 0 ? (
            <p className="py-10 text-center text-sm font-semibold text-gray-400">
              Henüz görünür kullanıcı yok.
            </p>
          ) : (
            people.map((person, index) => {
              const name =
                person.full_name ||
                person.username ||
                "UIN üyesi";

              return (
                <Link
                  key={`${person.user_id ?? index}-${person.seed_id ?? index}`}
                  href={
                    person.username
                      ? `/u/${encodeURIComponent(person.username)}`
                      : "#"
                  }
                  onClick={onClose}
                  className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0"
                >
                  {person.avatar_url ? (
                    <img
                      src={person.avatar_url}
                      alt=""
                      className="h-11 w-11 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-gray-100">
                      👤
                    </span>
                  )}

                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm text-gray-950">
                      {name}
                    </b>
                    {person.username && (
                      <small className="block truncate text-xs text-gray-400">
                        @{person.username}
                      </small>
                    )}
                  </span>

                  {person.rating ? (
                    <span className="text-xs font-black text-amber-700">
                      ★ {person.rating}/10
                    </span>
                  ) : null}

                  <span className="text-gray-400">›</span>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}