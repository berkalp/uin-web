"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/utils/supabase/client";

const PRESETS = [1440, 180, 60, 30, 15, 5] as const;

type Defaults = {
  activity_offsets: number[];
  seed_offsets: number[];
  activity_notify_start: boolean;
  activity_notify_end: boolean;
  seed_notify_due: boolean;
  seed_target_time: string;
  timezone: string;
};

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Istanbul";
  } catch {
    return "Europe/Istanbul";
  }
}

function label(minutes: number) {
  if (minutes % 1440 === 0) return `${minutes / 1440} gün`;
  if (minutes % 60 === 0) return `${minutes / 60} saat`;
  return `${minutes} dk`;
}

export default function ReminderDefaultsPanel() {
  const [value, setValue] = useState<Defaults | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.rpc("get_my_reminder_defaults");
      if (error) {
        setMessage(error.message || "Varsayılan hatırlatıcılar yüklenemedi.");
        return;
      }
      const row = (data ?? {}) as Partial<Defaults>;
      setValue({
        activity_offsets: Array.isArray(row.activity_offsets) ? row.activity_offsets.map(Number) : [15],
        seed_offsets: Array.isArray(row.seed_offsets) ? row.seed_offsets.map(Number) : [1440],
        activity_notify_start: row.activity_notify_start !== false,
        activity_notify_end: row.activity_notify_end !== false,
        seed_notify_due: row.seed_notify_due !== false,
        seed_target_time: typeof row.seed_target_time === "string" ? row.seed_target_time.slice(0, 5) : "09:00",
        timezone: typeof row.timezone === "string" && row.timezone ? row.timezone : browserTimezone(),
      });
    })();
  }, []);

  if (!value) {
    return <div className="rounded-3xl border border-gray-200 bg-white p-6 text-sm text-gray-500">{message || "Hatırlatıcılar yükleniyor…"}</div>;
  }

  function toggle(kind: "activity_offsets" | "seed_offsets", offset: number) {
    const current = value![kind];
    setValue({
      ...value!,
      [kind]: current.includes(offset) ? current.filter((item) => item !== offset) : [...current, offset].sort((a, b) => b - a),
    });
  }

  async function save() {
    setIsSaving(true);
    setMessage(null);
    const { error } = await supabase.rpc("save_my_reminder_defaults", {
      p_activity_offsets: value.activity_offsets,
      p_seed_offsets: value.seed_offsets,
      p_activity_notify_start: value.activity_notify_start,
      p_activity_notify_end: value.activity_notify_end,
      p_seed_notify_due: value.seed_notify_due,
      p_seed_target_time: value.seed_target_time,
      p_timezone: value.timezone || browserTimezone(),
    });
    if (error) {
      setMessage(error.message || "Varsayılan hatırlatıcılar kaydedilemedi.");
      setIsSaving(false);
      return;
    }
    setMessage("Varsayılan hatırlatıcıların kaydedildi.");
    setIsSaving(false);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-blue-200 bg-blue-50/40 p-6">
        <p className="text-xs font-black uppercase tracking-[0.15em] text-blue-700">Activity varsayılanları</p>
        <h2 className="mt-2 text-xl font-black text-gray-950">Planlanan her Activity’de otomatik kullan</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((offset) => (
            <button key={offset} type="button" onClick={() => toggle("activity_offsets", offset)} className={`rounded-full border px-3 py-2 text-xs font-black ${value.activity_offsets.includes(offset) ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 bg-white text-gray-700"}`}>
              {value.activity_offsets.includes(offset) ? "✓ " : ""}{label(offset)} önce
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 text-sm font-bold">
            Activity başladığında
            <input type="checkbox" checked={value.activity_notify_start} onChange={(e) => setValue({ ...value, activity_notify_start: e.target.checked })} className="h-5 w-5 accent-green-600" />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 text-sm font-bold">
            Planlanan süre dolduğunda
            <input type="checkbox" checked={value.activity_notify_end} onChange={(e) => setValue({ ...value, activity_notify_end: e.target.checked })} className="h-5 w-5 accent-green-600" />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-green-200 bg-green-50/40 p-6">
        <p className="text-xs font-black uppercase tracking-[0.15em] text-green-700">Seed varsayılanları</p>
        <h2 className="mt-2 text-xl font-black text-gray-950">Hedef tarihi olan her Tohumda otomatik kullan</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((offset) => (
            <button key={offset} type="button" onClick={() => toggle("seed_offsets", offset)} className={`rounded-full border px-3 py-2 text-xs font-black ${value.seed_offsets.includes(offset) ? "border-green-600 bg-green-600 text-white" : "border-gray-200 bg-white text-gray-700"}`}>
              {value.seed_offsets.includes(offset) ? "✓ " : ""}{label(offset)} önce
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <label className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 text-sm font-bold">
            Hedef zamanı geldiğinde
            <input type="checkbox" checked={value.seed_notify_due} onChange={(e) => setValue({ ...value, seed_notify_due: e.target.checked })} className="h-5 w-5 accent-green-600" />
          </label>
          <label className="rounded-2xl border border-gray-200 bg-white p-4">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Varsayılan hedef saati</span>
            <input type="time" value={value.seed_target_time} onChange={(e) => setValue({ ...value, seed_target_time: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold" />
          </label>
          <label className="rounded-2xl border border-gray-200 bg-white p-4">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Saat dilimi</span>
            <input value={value.timezone} onChange={(e) => setValue({ ...value, timezone: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold" />
          </label>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-gray-200 bg-white p-5">
        <p className="max-w-2xl text-sm leading-6 text-gray-600">Bu ayarlar yeni planlanan Activity ve hedef tarihli Tohumlara otomatik uygulanır. Her Activity veya Tohum içinde kişisel olarak değiştirebilirsin.</p>
        <button type="button" onClick={save} disabled={isSaving} className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
          {isSaving ? "Kaydediliyor…" : "Varsayılanları Kaydet"}
        </button>
      </div>

      {message && <p className={`text-sm font-bold ${message.includes("kaydedildi") ? "text-green-700" : "text-red-700"}`}>{message}</p>}
    </div>
  );
}
