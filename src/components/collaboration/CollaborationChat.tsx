"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import CommonTargetEventForm from "@/components/intentions/CommonTargetEventForm";
import CardRatingBadge from "@/components/cards/CardRatingBadge";
import {
  getCollaborationActivityPresentation,
  parseCollaborationActivity,
  type CollaborationActivitySummary,
  type CollaborationActivityTone,
} from "@/lib/collaborationActivity";
import { supabase } from "@/utils/supabase/client";

type Message = { id: string; sender_user_id: string; body: string; created_at: string; sender_full_name: string; sender_username: string | null; sender_avatar_url: string | null };
export type ChatDetail = { chat_id: string; seed_id: string | null; canonical_target_id: string | null; seed_title: string; status: string; planning_proposed_by: string | null; viewer_id: string; viewer_message_count: number | string; other_message_count: number | string; other_user_id: string; other_full_name: string; other_username: string | null; other_avatar_url: string | null; messages: Message[] };
export type ChatPlan = {
  planning_creator_user_id: string | null;
  planning_intent_id: string | null;
  activity: CollaborationActivitySummary | null;
  activityVerification: "verified" | "unavailable";
};
export type ChatCardContext = {
  targetId: string; title: string; subtitle: string | null; coverUrl: string | null;
  typeLabel: string; typeIcon: string; wantingCount: number; doneCount: number; activeEventCount: number;
  averageRating: number | null; ratingCount: number; followerCount: number;
  people: Array<{ userId: string; name: string; avatarUrl: string | null }>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isNullableUuid(value: unknown): value is string | null {
  return value === null || isUuid(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function parseReloadedChat(value: unknown): ChatDetail {
  if (!isRecord(value)
    || !isUuid(value.chat_id)
    || !isNullableUuid(value.seed_id)
    || !isNullableUuid(value.canonical_target_id)
    || (value.seed_id === null && value.canonical_target_id === null)
    || typeof value.seed_title !== "string"
    || !value.seed_title.trim()
    || typeof value.status !== "string"
    || !value.status.trim()
    || !isNullableUuid(value.planning_proposed_by)
    || !isUuid(value.viewer_id)
    || !isUuid(value.other_user_id)
    || typeof value.other_full_name !== "string"
    || !value.other_full_name.trim()
    || !isNullableString(value.other_username)
    || !isNullableString(value.other_avatar_url)
    || !Array.isArray(value.messages)
    || !value.messages.every((message) => isRecord(message)
      && isUuid(message.id)
      && isUuid(message.sender_user_id)
      && typeof message.body === "string"
      && typeof message.created_at === "string"
      && Number.isFinite(Date.parse(message.created_at))
      && typeof message.sender_full_name === "string"
      && message.sender_full_name.trim().length > 0
      && isNullableString(message.sender_username)
      && isNullableString(message.sender_avatar_url))) {
    throw new Error("Sohbet güncellemesi eksik geldi. Lütfen yeniden deneyin.");
  }
  for (const count of [value.viewer_message_count, value.other_message_count]) {
    if ((typeof count !== "number" && typeof count !== "string") || !Number.isFinite(Number(count)) || Number(count) < 0) {
      throw new Error("Sohbet sayaçları doğrulanamadı. Lütfen yeniden deneyin.");
    }
  }
  return value as unknown as ChatDetail;
}

export function parseChatPlan(value: unknown, fallbackTitle: string): ChatPlan {
  if (!isRecord(value)
    || (value.planning_creator_user_id !== null && !isUuid(value.planning_creator_user_id))
    || (value.planning_intent_id !== null && !isUuid(value.planning_intent_id))) {
    throw new Error("Planlama bilgileri eksik. Lütfen yeniden deneyin.");
  }
  const activity = parseCollaborationActivity(value, fallbackTitle);
  if ((activity?.intentId ?? null) !== value.planning_intent_id) {
    throw new Error("Planlama ve etkinlik bağlantısı eşleşmiyor. Lütfen yeniden deneyin.");
  }
  return {
    planning_creator_user_id: value.planning_creator_user_id,
    planning_intent_id: value.planning_intent_id,
    activity,
    activityVerification: "verified",
  };
}

function unavailablePlan(): ChatPlan {
  return {
    planning_creator_user_id: null,
    planning_intent_id: null,
    activity: null,
    activityVerification: "unavailable",
  };
}

const activityToneClasses: Record<CollaborationActivityTone, { panel: string; badge: string; button: string }> = {
  amber: { panel: "border-amber-300 bg-amber-50", badge: "bg-amber-100 text-amber-900", button: "bg-amber-700 text-white" },
  green: { panel: "border-emerald-300 bg-emerald-50", badge: "bg-emerald-100 text-emerald-900", button: "bg-emerald-700 text-white" },
  slate: { panel: "border-slate-300 bg-slate-50", badge: "bg-slate-200 text-slate-800", button: "bg-slate-800 text-white" },
  red: { panel: "border-red-300 bg-red-50", badge: "bg-red-100 text-red-800", button: "bg-red-700 text-white" },
};

export default function CollaborationChat({ initialChat, initialPlan, targetId, targetTitle, targetAction, initialActivityId, cardContext, cardContextUnavailable = false }: { initialChat: ChatDetail; initialPlan: ChatPlan; targetId: string | null; targetTitle: string; targetAction: string; initialActivityId: string | null; cardContext: ChatCardContext | null; cardContextUnavailable?: boolean }) {
  const router = useRouter();
  const [chat, setChat] = useState(initialChat);
  const [plan, setPlan] = useState(initialPlan);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [showPlanner, setShowPlanner] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [chatResult, planResult] = await Promise.all([
        supabase.rpc("get_personal_intent_collaboration_chat_v34", { p_suggestion_id: initialChat.chat_id }),
        supabase.rpc("get_personal_intent_collaboration_plan_v170", { p_suggestion_id: initialChat.chat_id }),
      ]);
      if (chatResult.error || chatResult.data === null) {
        throw new Error(chatResult.error?.message || "Sohbet güncellenemedi.");
      }
      const nextChat = parseReloadedChat(chatResult.data);
      setChat(nextChat);
      if (planResult.error || planResult.data === null) {
        throw new Error(planResult.error?.message || "Etkinliğin güncel durumu doğrulanamadı.");
      }
      const nextPlan = parseChatPlan(planResult.data, nextChat.seed_title);
      setPlan(nextPlan);
      setRefreshError("");
    } catch (problem) {
      setPlan(unavailablePlan());
      setRefreshError(problem instanceof Error ? problem.message : "Sohbet ve etkinlik güncellenemedi. Lütfen yeniden deneyin.");
    }
  }, [initialChat.chat_id]);

  useEffect(() => {
    void supabase.rpc("mark_personal_intent_collaboration_chat_read_v34", { p_suggestion_id: initialChat.chat_id });
    const channel = supabase.channel(`collaboration:${initialChat.chat_id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "personal_intent_collaboration_messages", filter: `suggestion_id=eq.${initialChat.chat_id}` }, () => { void reload(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [initialChat.chat_id, reload]);

  async function send() {
    if (!body.trim() || Number(chat.viewer_message_count) >= 20 || !["chat", "planning_proposed"].includes(chat.status)) return;
    setBusy(true); setError("");
    const { error: problem } = await supabase.rpc("send_personal_intent_collaboration_message_v34", { p_suggestion_id: chat.chat_id, p_body: body.trim() });
    if (problem) setError(problem.message || "Mesaj gönderilemedi.");
    else { setBody(""); await reload(); }
    setBusy(false);
  }

  async function proposePlanning() {
    setBusy(true); setError("");
    const { error: problem } = await supabase.rpc("propose_personal_intent_planning_v34", { p_suggestion_id: chat.chat_id });
    if (problem) setError(problem.message || "Planlama önerilemedi."); else await reload();
    setBusy(false);
  }

  async function respondPlanning(accept: boolean) {
    setBusy(true); setError("");
    const { error: problem } = await supabase.rpc("respond_personal_intent_planning_v34", { p_suggestion_id: chat.chat_id, p_accept: accept });
    if (problem) setError(problem.message || "Yanıt kaydedilemedi."); else await reload();
    setBusy(false);
  }

  async function finalize(intentId: string) {
    setBusy(true); setError("");
    const { error: problem } = await supabase.rpc("finalize_personal_intent_collaboration_plan_v35", { p_suggestion_id: chat.chat_id, p_intent_id: intentId });
    if (problem) { setError(problem.message || "Plan sohbetle bağlanamadı."); setBusy(false); return; }
    await reload();
    router.push(`/activities/${encodeURIComponent(intentId)}`);
  }

  async function closeChat() {
    setBusy(true); setError("");
    const { error: problem } = await supabase.rpc("close_personal_intent_collaboration_chat_v34", { p_suggestion_id: chat.chat_id });
    if (problem) setError(problem.message || "Sohbet kapatılamadı."); else router.push("/collaboration-suggestions");
    setBusy(false);
  }

  const ownCount = Number(chat.viewer_message_count || 0);
  const canMessage = ["chat", "planning_proposed"].includes(chat.status) && ownCount < 20;
  const planningByMe = chat.planning_proposed_by === chat.viewer_id;
  const activityPresentation = plan.activity
    ? getCollaborationActivityPresentation(plan.activity)
    : null;
  const activityTone = activityPresentation ? activityToneClasses[activityPresentation.tone] : null;
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
    <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <header className="flex items-center gap-4 border-b p-5 md:p-7">{chat.other_avatar_url ? <img src={chat.other_avatar_url} alt="" className="h-12 w-12 rounded-full object-cover"/> : <span className="grid h-12 w-12 place-items-center rounded-full bg-gray-100 font-black">{chat.other_full_name.charAt(0)}</span>}<div className="min-w-0"><h1 className="truncate text-xl font-black">{chat.other_full_name}</h1><p className="truncate text-sm text-gray-500">{targetTitle}</p></div></header>
      <div className="max-h-[58vh] space-y-3 overflow-y-auto bg-gray-50 p-4 md:p-6">{chat.messages.length ? chat.messages.map((message) => { const own = message.sender_user_id === chat.viewer_id; return <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 ${own ? "bg-emerald-600 text-white" : "border bg-white text-gray-900"}`}><p className="whitespace-pre-wrap text-sm">{message.body}</p><p className={`mt-1 text-[10px] ${own ? "text-emerald-100" : "text-gray-400"}`}>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(new Date(message.created_at))}</p></div></div>; }) : <p className="py-12 text-center text-sm text-gray-500">Sohbet açıldı. İlk mesajı göndererek beklentilerinizi konuşun.</p>}</div>
      {canMessage ? <div className="border-t p-4 md:p-6"><div className="flex gap-2"><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={1000} rows={2} placeholder="Mesajını yaz…" disabled={busy} className="min-w-0 flex-1 resize-none rounded-2xl border border-gray-200 px-4 py-3"/><button type="button" disabled={!body.trim() || busy} onClick={() => void send()} className="rounded-2xl bg-gray-950 px-5 font-black text-white disabled:bg-gray-300">Gönder</button></div><div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500"><span>Kişi başı 20 mesaj · Sen {ownCount}/20</span></div></div> : <div className="border-t bg-gray-50 p-4 text-sm font-semibold text-gray-500 md:px-6">{chat.status === "closed" ? "Bu tanışma sohbeti kapatıldı." : ownCount >= 20 ? "20 mesaj hakkını kullandın. Planlamaya geçebilir veya sohbeti kapatabilirsin." : "Planlama onaylandı; konuşma geçmişi okunabilir."}</div>}
    </section>
    <aside className="space-y-4">
      {cardContextUnavailable && <section role="alert" className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900"><p>Kütüphane kartı bilgileri şu anda doğrulanamadı. Sohbet ve planlama verilerin kullanılabilir.</p>{targetId && <Link href={`/ideas?targetId=${encodeURIComponent(targetId)}`} className="mt-3 inline-block font-black underline">Kartı yeniden aç</Link>}</section>}
      {cardContext && <Link href={`/ideas?targetId=${encodeURIComponent(cardContext.targetId)}`} aria-label={`${cardContext.title} Kütüphane kartını aç`} className="uin-perfect-card relative block overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl">
        <div className="relative min-h-[285px] p-4">{cardContext.coverUrl ? <img src={cardContext.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover"/> : <span className="absolute inset-0 grid place-items-center text-6xl">{cardContext.typeIcon}</span>}<div className="absolute inset-0 bg-slate-950/35"/>
          <div className="relative z-10 flex h-full min-h-[253px] flex-col"><div className="flex items-start justify-between gap-2"><span className="rounded-full bg-white/95 px-3 py-2 text-xs font-black text-emerald-900">{cardContext.typeIcon} {cardContext.typeLabel}</span><span className="flex flex-col items-end gap-1"><CardRatingBadge averageRating={cardContext.ratingCount ? cardContext.averageRating : null} ratingCount={cardContext.ratingCount} compact/><span className="rounded-full bg-emerald-50/95 px-2.5 py-1 text-[10px] font-black text-emerald-800">🔔 {cardContext.followerCount} takipçi</span></span></div><div className="flex-1"/>
            <div className="rounded-2xl border border-white/15 bg-slate-950/85 p-3 backdrop-blur-sm"><p className="text-[10px] font-black uppercase tracking-wide text-emerald-300">İlgili Kütüphane kartı</p><h2 className="mt-1 text-lg font-black leading-snug text-white">{cardContext.title}</h2>{cardContext.subtitle && <p className="mt-1 truncate text-xs text-white/70">{cardContext.subtitle}</p>}<div className="mt-3 grid grid-cols-3 gap-1.5">{[["İsteyenler",cardContext.wantingCount],["Deneyimleyenler",cardContext.doneCount],["Aktif etkinlikler",cardContext.activeEventCount]].map(([label,value]) => <div key={String(label)} className="flex min-h-[58px] flex-col items-center justify-center rounded-xl border border-white/15 bg-white/10 px-1 text-center"><span className="text-[8px] font-bold leading-tight text-white/70">{label}</span><b className="mt-1 text-lg text-white">{value}</b></div>)}</div></div>
          </div>
        </div>
        <div className="border-t border-white/10 bg-slate-950 px-4 py-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-white">Bu kartı isteyenler</p><p className="mt-1 text-[10px] text-slate-400">Sizden başka kimlerin ilgilendiğini burada görebilirsin.</p></div><b className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-300">{cardContext.wantingCount}</b></div>{cardContext.people.length ? <div className="mt-3 flex items-center"><div className="flex -space-x-2">{cardContext.people.slice(0,5).map((person) => person.avatarUrl ? <img key={person.userId} src={person.avatarUrl} title={person.name} alt={person.name} className="h-9 w-9 rounded-full border-2 border-slate-950 object-cover"/> : <span key={person.userId} title={person.name} className="grid h-9 w-9 place-items-center rounded-full border-2 border-slate-950 bg-emerald-100 text-xs font-black text-emerald-900">{person.name.charAt(0)}</span>)}</div>{cardContext.wantingCount > 5 && <span className="ml-3 text-xs font-bold text-slate-300">+{cardContext.wantingCount - 5} kişi</span>}</div> : <p className="mt-3 text-xs text-slate-400">Henüz başka isteyen yok.</p>}</div>
      </Link>}
      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[.15em] text-emerald-700">Birlikte yapma akışı</p>
        <h2 className="mt-2 text-lg font-black">{chat.seed_title}</h2>
        <p className="mt-2 text-sm text-gray-500">Etkinliğin adı, zamanı ve güncel durumu burada birlikte kalır.</p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        {refreshError && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p className="font-semibold">{refreshError}</p><p className="mt-1 text-xs">Eski etkinlik durumunu göstermiyoruz.</p><button type="button" onClick={() => void reload()} className="mt-3 rounded-lg bg-red-700 px-3 py-2 text-xs font-black text-white">Yeniden dene</button></div>}
        <div className="mt-5 space-y-3">
          {plan.activityVerification === "unavailable" ? !refreshError && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">Etkinliğin güncel durumu doğrulanamadı. Güncel bilgiyi almak için sayfayı yenileyin.</p> : activityPresentation && activityTone && plan.activity ? <section className={`rounded-2xl border p-4 ${activityTone.panel}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.14em] text-gray-600">Bağlı etkinlik</p><h3 className="mt-1 text-lg font-black leading-snug text-gray-950">{plan.activity.title}</h3></div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${activityTone.badge}`}>{activityPresentation.label}</span>
            </div>
            <div className="mt-3 space-y-1 text-sm font-semibold text-gray-700"><p>📅 {activityPresentation.dateLabel}</p>{activityPresentation.locationLabel && <p>📍 {activityPresentation.locationLabel}</p>}</div>
            <Link href={activityPresentation.href} className={`mt-4 block rounded-xl px-4 py-3 text-center text-sm font-black ${activityTone.button}`}>{activityPresentation.actionLabel}</Link>
          </section> : plan.planning_intent_id ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">Etkinliğin güncel durumu doğrulanamadı. Yeniden deneyin.</p> : chat.status === "chat" ? <button type="button" disabled={busy} onClick={() => void proposePlanning()} className="w-full rounded-xl bg-violet-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50">Planlamaya geçmeyi öner</button> : chat.status === "planning_proposed" && !planningByMe ? <><button type="button" disabled={busy} onClick={() => void respondPlanning(true)} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white">Kabul et ve planlamaya geç</button><button type="button" disabled={busy} onClick={() => void respondPlanning(false)} className="w-full rounded-xl border px-4 py-3 text-sm font-bold">Biraz daha konuşalım</button></> : chat.status === "planning_proposed" ? <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Karşı tarafın planlama yanıtı bekleniyor.</p> : chat.status === "planning_ready" && plan.planning_creator_user_id === chat.viewer_id ? <button type="button" onClick={() => setShowPlanner(true)} className="w-full rounded-xl bg-violet-700 px-4 py-3 text-sm font-black text-white">Etkinlik planını oluştur</button> : chat.status === "planning_ready" ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Niyet sahibi etkinlik planını hazırlıyor.</p> : <p className="rounded-xl bg-gray-100 p-3 text-sm font-semibold text-gray-600">Bu sohbet kapalı.</p>}
          {chat.status !== "closed" && <button type="button" disabled={busy} onClick={() => void closeChat()} className="w-full rounded-xl border px-4 py-3 text-sm font-bold text-gray-600">Sohbeti kapat</button>}
        </div>
      </section>
    </aside>
    {showPlanner && targetId && <div className="fixed inset-0 z-[150] overflow-y-auto bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPlanner(false); }}><section className="mx-auto my-6 max-w-3xl rounded-3xl bg-white p-5 shadow-2xl md:p-7"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-2xl font-black">Birlikte etkinlik planla</h2><p className="text-sm text-gray-500">{targetTitle}</p></div><button type="button" onClick={() => setShowPlanner(false)} className="grid h-10 w-10 place-items-center rounded-full bg-gray-100 text-xl">×</button></div><CommonTargetEventForm targetId={targetId} targetTitle={targetTitle} targetAction={targetAction} initialActivityId={initialActivityId || ""} onSaved={(intentId) => void finalize(intentId)}/></section></div>}
  </div>;
}
