"use client";
import Link from "next/link";

import CardRatingBadge from "@/components/cards/CardRatingBadge";
import PersonalLibraryCard from "@/components/cards/PersonalLibraryCard";
import CanonicalTargetPeople from "@/components/seeds/CanonicalTargetPeople";
import { targetLanguage, cardDate } from "@/utils/targetLanguage";
import type { PublicProfileSeedRecord } from "@/utils/seeds";

function experienceDate(seed: PublicProfileSeedRecord) {
  if (seed.experience_precision === "year") {
    return seed.experience_year ? String(seed.experience_year) : "Tarih belirtilmedi";
  }

  if (seed.experience_precision === "unknown") {
    return "Tarih belirtilmedi";
  }

  return cardDate(seed.experience_date) || "Tarih belirtilmedi";
}

export default function ProfileSeedCard({
  seed,
  displayName,
  isOwner,
}: {
  seed: PublicProfileSeedRecord;
  displayName: string;
  isOwner: boolean;
}) {
  const words = targetLanguage(seed.seed_type_slug);
  const done = seed.status === "completed";
  const href = `/seeds/${encodeURIComponent(seed.seed_id)}`;
  const editHref = done ? `${href}?editExperience=1` : `${href}/edit`;
  const firstName = displayName.trim().split(/\s+/)[0] || "Profil";

  return (
    <PersonalLibraryCard
      title={seed.title}
      subtitle={seed.subtitle}
      coverUrl={seed.cover_url}
      href={href}
      badge={seed.seed_type_name || (done ? "Deneyim" : "Kütüphane")}
      icon={seed.seed_type_icon || words.icon}
      cornerMeta={
        done ? (
          <CardRatingBadge
            personalRating={seed.personal_rating}
            personalLabel={isOwner ? "Puanım" : `${firstName} puanı`}
            personalUnratedLabel="Puan verilmedi"
            compact
          />
        ) : null
      }
      summary={
        <div className="space-y-1.5">
          {done ? (
            <>
              <p className="font-black text-blue-200">✓ {experienceDate(seed)}</p>
              {seed.key_takeaway && (
                <p className="line-clamp-2 text-white/85">“{seed.key_takeaway}”</p>
              )}
            </>
          ) : (
            <>
              <p className="font-black text-emerald-200">{words.want}</p>
              <p>📅 {cardDate(seed.target_date) || "Zaman esnek"}</p>
              {seed.notes && <p className="line-clamp-2 text-white/80">{seed.notes}</p>}
            </>
          )}
        </div>
      }
      metrics={
        seed.seed_scope === "library" ? (
          <CanonicalTargetPeople
            seedId={seed.seed_id}
            targetId={seed.canonical_target_id}
            seedType={seed.seed_type_slug}
            appearance="overlay"
          />
        ) : (
          <p className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white/80">
            🔒 Bu kayıt yalnızca sana ait.
          </p>
        )
      }
      action={
        <Link
          href={isOwner ? editHref : href}
          className="flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-3 text-center text-xs font-black text-white transition hover:bg-emerald-700"
        >
          {isOwner
            ? done
              ? "Deneyimimi düzenle"
              : "İsteğimi düzenle"
            : done
              ? "Deneyimi gör"
              : "Niyeti gör"}
        </Link>
      }
    />
  );
}
