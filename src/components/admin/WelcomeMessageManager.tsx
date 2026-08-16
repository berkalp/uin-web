"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

export type WelcomeAdminSettings = {
  enabled: boolean;
  sender_user_id: string | null;
  sender_full_name: string | null;
  sender_username: string | null;
  sender_avatar_url: string | null;
  reply_window_days: number | string;
  message_version: number | string;
  message_bubbles: string[] | null;
  delivered_count: number | string;
  last_delivered_at: string | null;
  updated_at: string;
};

const FALLBACK_MESSAGES = [
  `Selam 👋 Ben Berkalp. UIN’i geliştiren kişiyim. Buraya hoş geldin. 💚

UIN’i insanların bir uygulamada daha fazla vakit geçirmesi için değil, gerçek hayatta yapmak istedikleri şeyleri gerçekten yapmalarını kolaylaştırmak için geliştirdim.`,
  `UIN’de iki şeyle başlamanı öneririm:

🌱 Tohum: Henüz planlamadığın ama yapmak, görmek, okumak, izlemek, öğrenmek veya denemek istediğin kişisel bir olasılık.

🎯 Niyet: Gerçekten yapmak istediğin ve başkalarıyla paylaşabileceğin bir şey. Konsere gitmek, spor yapmak, seyahat etmek, bir şey öğrenmek, kahve içmek gibi.

Mümkünse denemek için uydurma şeyler değil, gerçek Tohumlarını ve gerçek Niyetlerini ekle.`,
  `UIN’in yolu kabaca şöyle:

🌱 Tohum → 🎯 Niyet → 🤝 Plan → 🏃 Aktivite → 🧠 Anı

Bir Niyet açtığında aynı şeyi yapmak isteyen doğru insanlarla karşılaşabilirsin. Uygun olduğunuzda birlikte planlarsınız, gerçekten yaparsınız ve sonrasında yaşadığınız şey UIN’de geçmişinizin bir parçası olur.`,
  `Birkaç önemli kural var:

🛡 Kimseyle konuşmak veya buluşmak zorunda değilsin.
👥 Kimlerle bir şey yapmak istediğini sen belirlersin.
👁 Görünürlüğünü ve sınırlarını sen seçersin.
🤝 Bir Plana dahil olduysan diğer insanların zamanına saygı göster.
🚩 Rahatsız edici veya güven vermeyen bir durumda UIN içindeki bildirme araçlarını kullan.

UIN’in amacı mümkün olduğunca çok insanla tanışmak değil. Aynı Niyetteki doğru insanı bulmak.`,
  `İlk kullanıcılarımdan biri olduğun için senden özellikle bir ricam var. 🙏

Yaklaşık 1 hafta UIN’i gerçekten kullanmaya çalış. Tohum ek, Niyet oluştur, insanların Niyetlerine bak, katılmayı dene, Planlama ve Aktivite Odalarını kullan.

Anlamadığın, saçma bulduğun, eksik hissettiğin veya çalışmayan ne varsa bana buradan yaz. Bir sorun görürsen hangi ekranda olduğunu, ne yaptığını ve ne olduğunu kısaca anlat. İyi çalışan şeyleri de söyle ki neyi korumamız gerektiğini bileyim.

UIN’in bundan sonraki halini ilk kullanıcıların gerçek kullanımı şekillendirecek.

Hoş geldin. Are you in? 💚`,
];

function toNumber(value: number | string | null | undefined, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDate(value: string | null) {
  if (!value) return "Henüz yok";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Henüz yok";

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function WelcomeMessageManager({
  initialSettings,
}: {
  initialSettings: WelcomeAdminSettings | null;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialSettings?.enabled ?? true);
  const [replyDays, setReplyDays] = useState(
    Math.max(1, toNumber(initialSettings?.reply_window_days, 7))
  );
  const [messages, setMessages] = useState<string[]>(
    Array.isArray(initialSettings?.message_bubbles) &&
      initialSettings.message_bubbles.length > 0
      ? initialSettings.message_bubbles
      : FALLBACK_MESSAGES
  );
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const valid = useMemo(
    () =>
      replyDays >= 1 &&
      replyDays <= 30 &&
      messages.length >= 1 &&
      messages.length <= 10 &&
      messages.every((message) => message.trim().length > 0 && message.trim().length <= 5000),
    [messages, replyDays]
  );

  function updateMessage(index: number, value: string) {
    setMessages((current) =>
      current.map((message, messageIndex) =>
        messageIndex === index ? value : message
      )
    );
  }

  function removeMessage(index: number) {
    setMessages((current) => current.filter((_, messageIndex) => messageIndex !== index));
  }

  async function save() {
    if (!valid || saving) return;

    setSaving(true);
    setResult(null);

    const { error } = await supabase.rpc("update_uin_welcome_settings", {
      p_enabled: enabled,
      p_reply_window_days: replyDays,
      p_message_bubbles: messages.map((message) => message.trim()),
    });

    if (error) {
      setResult({
        tone: "error",
        text: error.message || "Ayarlar kaydedilemedi.",
      });
    } else {
      setResult({
        tone: "success",
        text: enabled
          ? "Kaydedildi. Bundan sonra onboarding’i ilk kez tamamlayan yeni kullanıcılar bu konuşmayı otomatik alacak."
          : "Kaydedildi. Otomatik karşılama şu anda kapalı.",
      });
      router.refresh();
    }

    setSaving(false);
  }

  const senderName =
    initialSettings?.sender_full_name ||
    initialSettings?.sender_username ||
    "Henüz gönderen hesap seçilmedi";

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-950">Otomatik gönderim</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Kaydettiğinde gönderen hesap otomatik olarak şu an giriş yaptığın Owner hesabı olur.
              Aynı kullanıcıya yalnızca bir kez gönderilir.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setEnabled((value) => !value)}
            className={`rounded-full px-5 py-3 text-sm font-black transition ${
              enabled
                ? "bg-green-600 text-white"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {enabled ? "Açık" : "Kapalı"}
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-xs font-bold text-gray-400">Gönderen</p>
            <p className="mt-2 text-sm font-black text-gray-900">{senderName}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-xs font-bold text-gray-400">Mesaj sürümü</p>
            <p className="mt-2 text-sm font-black text-gray-900">
              v{toNumber(initialSettings?.message_version, 1)}
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-xs font-bold text-gray-400">Gönderilen</p>
            <p className="mt-2 text-sm font-black text-gray-900">
              {toNumber(initialSettings?.delivered_count)}
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-xs font-bold text-gray-400">Son gönderim</p>
            <p className="mt-2 text-sm font-black text-gray-900">
              {formatDate(initialSettings?.last_delivered_at ?? null)}
            </p>
          </div>
        </div>

        <label className="mt-6 block">
          <span className="text-sm font-black text-gray-900">Kullanıcının cevap hakkı</span>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={30}
              value={replyDays}
              onChange={(event) => setReplyDays(Number(event.target.value))}
              className="w-28 rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:border-green-500"
            />
            <span className="text-sm text-gray-500">gün</span>
          </div>
        </label>
      </section>

      <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-950">Mesaj balonları</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Kullanıcı bunları tek bir duvar yazısı olarak değil, sırayla gönderilmiş gerçek mesajlar olarak görür.
            </p>
          </div>

          <button
            type="button"
            disabled={messages.length >= 10}
            onClick={() => setMessages((current) => [...current, ""])}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-black text-gray-700 disabled:opacity-40"
          >
            + Mesaj ekle
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {messages.map((message, index) => (
            <div key={index} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-xs font-black text-green-700">
                  {index + 1}/{messages.length}
                </span>
                {messages.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeMessage(index)}
                    className="text-xs font-bold text-red-600"
                  >
                    Kaldır
                  </button>
                ) : null}
              </div>
              <textarea
                rows={7}
                value={message}
                onChange={(event) => updateMessage(index, event.target.value)}
                className="w-full resize-y rounded-xl border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-900 outline-none focus:border-green-500"
              />
              <p className="mt-2 text-right text-xs text-gray-400">
                {message.trim().length} / 5000
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-green-200 bg-green-50/50 p-6">
        <h2 className="text-lg font-black text-gray-950">Mobil önizleme</h2>
        <div className="mt-5 max-w-xl space-y-3">
          {messages.filter((message) => message.trim()).map((message, index) => (
            <div
              key={index}
              className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-800 shadow-sm"
            >
              {message}
            </div>
          ))}
        </div>
      </section>

      {result ? (
        <div
          className={`rounded-2xl border p-4 text-sm font-bold ${
            result.tone === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {result.text}
        </div>
      ) : null}

      <button
        type="button"
        disabled={!valid || saving}
        onClick={() => void save()}
        className="w-full rounded-2xl bg-gray-950 px-6 py-4 text-sm font-black text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? "Kaydediliyor..." : "Karşılama mesajını kaydet"}
      </button>
    </div>
  );
}
