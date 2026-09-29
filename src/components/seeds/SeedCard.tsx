"use client";
import Link from "next/link";
import PersonalLibraryCard from "@/components/cards/PersonalLibraryCard";
import CardRatingBadge from "@/components/cards/CardRatingBadge";
import PersonalWishSummary,{wishBadge,wishHow,wishWhen,wishWords,type WishPresentation} from "@/components/cards/PersonalWishSummary";
import UinCard, { cardPrimary, cardSecondary } from "@/components/cards/UinCard";
import TargetHighlight from "@/components/cards/TargetHighlight";
import CanonicalTargetPeople from "@/components/seeds/CanonicalTargetPeople";
import { cardDate, targetLanguage } from "@/utils/targetLanguage";
import { type SeedRecord, isSeedPastDue } from "@/utils/seeds";

export default function SeedCard({ seed,editable=false,variant }: {
  seed: SeedRecord; isAuthenticated: boolean;editable?:boolean; reminderTargetTime?: string | null;
  reminderTimezone?: string | null; variant?: "seeds" | "timeline" | "experience";
}) {
  const completed = seed.status === "completed";
  const archived = seed.status === "archived";
  const privateSeed = seed.seed_scope === "private";
  const words = targetLanguage(seed.seed_type_slug);
  const presentation:WishPresentation=seed.wish_presentation||{type_id:seed.seed_type_slug,type_label:seed.seed_type_name,type_icon:seed.seed_type_icon,base_kind:"activity",start_date:seed.target_date,end_date:null,timing_precision:seed.target_date?"day":"flexible",date_options:[],location:null};
  const actionWants:Record<string,string>={"ÖĞREN":"Öğrenmek istiyorum","KEŞFET":"Keşfetmek istiyorum","ZİYARET ET":"Ziyaret etmek istiyorum","PRATİK YAP":"Pratik yapmak istiyorum","ÜRET":"Üretmek istiyorum"};
  const wantLabel=presentation.ui_labels?.want?.trim()||actionWants[words.action]||wishWords(presentation).want;
  const href = `/seeds/${seed.seed_id}`;
  if (variant === "experience" && completed) {
    const experienceWords=wishWords(presentation);
    return <PersonalLibraryCard
      title={seed.title}
      subtitle={seed.subtitle}
      coverUrl={seed.cover_url}
      badge={experienceWords.done}
      icon={presentation.type_icon||"✓"}
      href={href}
      cornerMeta={<CardRatingBadge targetId={seed.canonical_target_id} personalRating={seed.personal_rating}/>}
      metrics={!privateSeed?<CanonicalTargetPeople seedId={seed.seed_id} targetId={seed.canonical_target_id} seedType={seed.seed_type_slug} presentation={presentation} appearance="overlay" />:undefined}
      action={editable?<Link href={href} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-600 px-3 text-xs font-black text-white hover:bg-emerald-700">Deneyimimi düzenle</Link>:<Link href={href} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-white/10 px-3 text-xs font-black text-white hover:bg-white/15">Deneyimi aç</Link>}
    />;
  }
  if (variant === "timeline" && !completed && !archived) {
    return <PersonalLibraryCard
      title={seed.title}
      subtitle={seed.subtitle}
      coverUrl={seed.cover_url}
      badge={wishBadge(presentation)}
      icon={presentation.type_icon||words.icon}
      href={href}
      cornerMeta={<CardRatingBadge targetId={seed.canonical_target_id}/>}
      summary={<div className="space-y-1.5">
        <p className="font-black text-emerald-300">{wishHow(presentation)||wantLabel}</p>
        <p>📅 {wishWhen(presentation)}</p>
        <p className="line-clamp-1">📍 {presentation.location||"Konum belirlemedim"}</p>
        {isSeedPastDue(seed)&&<p className="font-bold text-amber-300">Süresi geçti · Tarihini yenileyebilirsin</p>}
      </div>}
      metrics={privateSeed
        ? <p className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white/80">🔒 Bu kayıt yalnızca sana ait.</p>
        : <CanonicalTargetPeople seedId={seed.seed_id} targetId={seed.canonical_target_id} seedType={seed.seed_type_slug} presentation={presentation} appearance="overlay" />}
      action={editable
        ? <Link href={`${href}/edit`} className="flex min-h-11 w-full items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700"><span>✓</span><span>İsteğimi düzenle</span></Link>
        : <span className="flex min-h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-bold text-white/80">✓ Ekli</span>}
    />;
  }
  return <UinCard title={seed.title} subtitle={seed.subtitle} category={!completed&&!archived?(wishHow(presentation)||(wishWords(presentation).action==="YAP"?words.action:wishWords(presentation).action)):words.action} icon={presentation.type_icon||words.icon}
    coverUrl={seed.cover_url} href={href} badge={completed ? "DENEYİMİM" : archived ? "ARŞİV" : wishBadge(presentation)} tone={completed ? "experience" : "target"}
    primary={editable?<Link href={completed?href:href+"/edit"} className={cardPrimary}>{completed?"Deneyimimi düzenle":"İsteğimi düzenle"}</Link>:<span className="flex min-h-10 w-full items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-2 text-[11px] font-semibold text-gray-500">{completed ? "✓ Deneyimlerimde" : archived ? "Arşivimde" : "✓ Ekli"}</span>}
    secondary={privateSeed || archived ? <Link href={`${href}/edit`} className={cardSecondary}>Düzenle</Link> : <TargetHighlight seedId={seed.seed_id} />}>
    {completed ? <div className="space-y-2">
      <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-900">✓ {seed.completed_date_precision === "year" ? seed.completed_year : seed.completed_date_precision === "unknown" ? "Tarih belirtilmedi" : cardDate(seed.completed_at) || "Tarih belirtilmedi"}</p>
      {typeof seed.personal_rating==="number"&&<p className="text-sm font-bold text-amber-700">★ {seed.personal_rating}/10</p>}
      {seed.key_takeaway && <p className="line-clamp-2 text-sm leading-5">“{seed.key_takeaway}”</p>}
      {!privateSeed && <CanonicalTargetPeople seedId={seed.seed_id} targetId={seed.canonical_target_id} seedType={seed.seed_type_slug} presentation={presentation} />}
    </div> : <div className="space-y-2">
      <PersonalWishSummary presentation={presentation} wantLabel={wantLabel} notes={seed.notes}/>{isSeedPastDue(seed)&&<p className="text-xs font-bold text-amber-700">Süresi geçti</p>}
      {!privateSeed && !archived && <CanonicalTargetPeople seedId={seed.seed_id} targetId={seed.canonical_target_id} seedType={seed.seed_type_slug} presentation={presentation} />}
      {privateSeed && <p className="text-xs">🔒 Bu kayıt yalnızca sana ait.</p>}
    </div>}
    {seed.canonical_source_seed_ids && seed.canonical_source_seed_ids.length > 1 && <details className="mt-2 text-xs"><summary className="cursor-pointer text-emerald-700">Önceki kayıtların ({seed.canonical_source_seed_ids.length})</summary>{seed.canonical_source_seed_ids.map((id, i) => <Link key={id} href={`/seeds/${id}`} className="block py-1">Kayıt {i + 1}</Link>)}</details>}
  </UinCard>;
}
