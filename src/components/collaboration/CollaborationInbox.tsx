"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/utils/supabase/client";

export type CollaborationRequest = {
  id: string;
  seed_id: string;
  seed_title: string;
  requester_user_id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type CollaborationChatSummary = {
  chat_id: string;
  seed_id: string;
  seed_title: string;
  other_user_id: string;
  other_full_name: string;
  other_username: string | null;
  other_avatar_url: string | null;
  status: string;
  viewer_message_count: number | string;
  other_message_count: number | string;
  unread_count: number | string;
  last_message_body: string | null;
  last_message_at: string | null;
};

export default function CollaborationInbox({ initialRequests, initialChats }: { initialRequests: CollaborationRequest[]; initialChats: CollaborationChatSummary[] }) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function answer(request: CollaborationRequest, response: "accepted" | "rejected") {
    setBusy(request.id);
    setError("");
    const { error: problem } = await supabase.rpc("respond_personal_intent_collaboration_suggestion_v34", {
      p_suggestion_id: request.id,
      p_response: response,
    });
    setBusy("");
    if (problem) {
      setError(problem.message || "Yanıt kaydedilemedi.");
      return;
    }
    setRequests((current) => current.filter((item) => item.id !== request.id));
    if (response === "accepted") router.push(`/collaboration-chat/${encodeURIComponent(request.id)}`);
    else router.refresh();
  }

  return <div className="space-y-8">
    {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
    <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <header className="border-b p-5 md:p-7"><h1 className="text-2xl font-black">Birlikte yapma önerileri</h1><p className="mt-1 text-sm text-gray-500">Öneriyi kabul edince 20’şer mesajlık tanışma sohbeti açılır.</p></header>
      <div className="divide-y divide-gray-100">{requests.length ? requests.map((request) => <article key={request.id} className="flex flex-wrap items-center justify-between gap-4 p-5 md:px-7">
        <div className="flex min-w-0 items-center gap-3">{request.avatar_url ? <img src={request.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover"/> : <span className="grid h-12 w-12 place-items-center rounded-full bg-gray-100 font-black">{request.full_name.charAt(0)}</span>}<div className="min-w-0"><p className="truncate font-black">{request.full_name} birlikte yapmayı önerdi</p><p className="mt-1 text-sm text-gray-500">{request.seed_title}</p></div></div>
        <div className="flex gap-2"><button type="button" disabled={busy === request.id} onClick={() => void answer(request, "accepted")} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">Kabul et ve sohbeti aç</button><button type="button" disabled={busy === request.id} onClick={() => void answer(request, "rejected")} className="rounded-xl border px-4 py-2.5 text-sm font-bold disabled:opacity-50">Kabul etme</button></div>
      </article>) : <p className="p-8 text-center text-sm text-gray-500">Yanıt bekleyen öneri yok.</p>}</div>
    </section>
    <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <header className="border-b p-5 md:p-7"><h2 className="text-2xl font-black">Tanışma sohbetleri</h2><p className="mt-1 text-sm text-gray-500">Önce konuşun; ikiniz de hazır olduğunuzda planlamaya geçin.</p></header>
      <div className="divide-y divide-gray-100">{initialChats.length ? initialChats.map((chat) => <Link key={chat.chat_id} href={`/collaboration-chat/${encodeURIComponent(chat.chat_id)}`} className="flex items-center gap-4 p-5 transition hover:bg-gray-50 md:px-7">
        {chat.other_avatar_url ? <img src={chat.other_avatar_url} alt="" className="h-12 w-12 rounded-full object-cover"/> : <span className="grid h-12 w-12 place-items-center rounded-full bg-gray-100 font-black">{chat.other_full_name.charAt(0)}</span>}
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate font-black">{chat.other_full_name}</p>{Number(chat.unread_count) > 0 && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">{chat.unread_count} yeni</span>}</div><p className="truncate text-sm text-gray-500">{chat.seed_title} · {chat.last_message_body || "Sohbet hazır"}</p></div><span className="text-xl text-gray-400">›</span>
      </Link>) : <p className="p-8 text-center text-sm text-gray-500">Henüz açık tanışma sohbetin yok.</p>}</div>
    </section>
  </div>;
}
