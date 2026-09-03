"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/utils/supabase/client";

type ResourceType = "plan" | "seed";

type ReminderSettings = {
  offsets: number[];
  notify_at_start: boolean;
  notify_at_end: boolean;
  seed_target_time: string;
  timezone: string;
  inherited: boolean;
};

type ReminderSettingsPanelProps = {
  resourceType: ResourceType;
  resourceId: string;
  title: string;
  hasTarget: boolean;
  timezone?: string | null;
  targetLabel?: string | null;
  compact?: boolean;
};

const PRESETS = [1440, 180, 60, 30, 15, 5] as const;

function labelForOffset(minutes: number) {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} gün önce`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} saat önce`;
  }
  return `${minutes} dk önce`;
}

function normalizeOffsets(values: number[]) {
  return Array.from(
    new Set(
      values
        .map((value) => Math.round(value))
        .filter((value) => Number.isFinite(value) && value > 0 && value <= 43200)
    )
  ).sort((a, b) => b - a);
}

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Istanbul";
  } catch {
    return "Europe/Istanbul";
  }
}

export default function ReminderSettingsPanel({
  resourceType,
  resourceId,
  title,
  hasTarget,
  timezone,
  targetLabel,
  compact = false,
}: ReminderSettingsPanelProps) {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("2");
  const [customUnit, setCustomUnit] = useState<"minutes" | "hours" | "days">("hours");

  const effectiveTimezone = useMemo(
    () => timezone?.trim() || browserTimezone(),
    [timezone]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setMessage(null);

      const { data, error } = await supabase.rpc("get_my_resource_reminder_settings", {
        p_resource_type: resourceType,
        p_resource_id: resourceId,
      });

      if (cancelled) return;

      if (error) {
        setMessage(error.message || "Hatırlatıcı ayarları yüklenemedi.");
        setIsLoading(false);
        return;
      }

      const row = (data ?? {}) as Partial<ReminderSettings>;
      setSettings({
        offsets: normalizeOffsets(Array.isArray(row.offsets) ? row.offsets.map(Number) : []),
        notify_at_start: Boolean(row.notify_at_start),
        notify_at_end: Boolean(row.notify_at_end),
        seed_target_time:
          typeof row.seed_target_time === "string" && row.seed_target_time
            ? row.seed_target_time.slice(0, 5)
            : "09:00",
        timezone:
          typeof row.timezone === "string" && row.timezone
            ? row.timezone
            : effectiveTimezone,
        inherited: Boolean(row.inherited),
      });
      setIsLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [effectiveTimezone, resourceId, resourceType]);

  function toggleOffset(offset: number) {
    if (!settings) return;
    const selected = settings.offsets.includes(offset);
    setSettings({
      ...settings,
      offsets: normalizeOffsets(
        selected
          ? settings.offsets.filter((item) => item !== offset)
          : [...settings.offsets, offset]
      ),
      inherited: false,
    });
  }

  function addCustom() {
    if (!settings) return;
    const amount = Number(customAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Geçerli bir süre gir.");
      return;
    }

    const multiplier = customUnit === "days" ? 1440 : customUnit === "hours" ? 60 : 1;
    const offset = Math.round(amount * multiplier);
    if (offset > 43200) {
      setMessage("Özel hatırlatıcı en fazla 30 gün önce olabilir.");
      return;
    }

    setSettings({
      ...settings,
      offsets: normalizeOffsets([...settings.offsets, offset]),
      inherited: false,
    });
    setMessage(null);
  }

  async function save() {
    if (!settings) return;
    setIsSaving(true);
    setMessage(null);

    const { error } = await supabase.rpc("save_my_resource_reminder_settings", {
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_offsets: settings.offsets,
      p_notify_at_start: settings.notify_at_start,
      p_notify_at_end: resourceType === "plan" ? settings.notify_at_end : false,
      p_seed_target_time:
        resourceType === "seed" ? settings.seed_target_time || "09:00" : null,
      p_timezone: resourceType === "seed" ? settings.timezone || effectiveTimezone : effectiveTimezone,
      p_enabled: true,
    });

    if (error) {
      setMessage(error.message || "Hatırlatıcılar kaydedilemedi.");
      setIsSaving(false);
      return;
    }

    setSettings({ ...settings, inherited: false });
    setMessage("Hatırlatıcıların kaydedildi.");
    setIsSaving(false);
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
        Hatırlatıcılar yükleniyor…
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
        {message || "Hatırlatıcı ayarları kullanılamıyor."}
      </div>
    );
  }

  if (compact) {
    const visibleOffsets = settings.offsets.slice(0, 4);
    const hiddenOffsetCount = Math.max(0, settings.offsets.length - visibleOffsets.length);

    return (
      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-gray-950">Hatırlatıcılar</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              {hasTarget
                ? targetLabel || "Aktivite zamanı için kişisel bildirimlerin."
                : "Aktivite zamanı netleştiğinde hatırlatıcılar devreye girer."}
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700">
            ♧
          </span>
        </div>

        <div className={`mt-4 space-y-2 ${!hasTarget ? "pointer-events-none opacity-45" : ""}`}>
          {visibleOffsets.map((offset) => (
            <label
              key={offset}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-3.5 py-3"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50 text-sm text-green-700">
                  ♧
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-gray-900">Aktiviteden {labelForOffset(offset)}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-gray-400">Kişisel bildirim</span>
                </span>
              </span>
              <input
                type="checkbox"
                checked
                onChange={() => toggleOffset(offset)}
                className="h-5 w-5 accent-green-600"
              />
            </label>
          ))}

          {visibleOffsets.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm font-semibold text-gray-500">
              Henüz başlangıçtan önce bir hatırlatıcı seçilmedi.
            </div>
          )}

          {hiddenOffsetCount > 0 && (
            <p className="px-1 text-xs font-bold text-gray-400">+{hiddenOffsetCount} hatırlatıcı daha</p>
          )}

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-3.5 py-3">
            <span className="text-sm font-black text-gray-900">Aktivite başladığında</span>
            <input
              type="checkbox"
              checked={settings.notify_at_start}
              onChange={(event) =>
                setSettings({ ...settings, notify_at_start: event.target.checked, inherited: false })
              }
              className="h-5 w-5 accent-green-600"
            />
          </label>

          {resourceType === "plan" && (
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-3.5 py-3">
              <span className="text-sm font-black text-gray-900">Aktivite süresi dolduğunda</span>
              <input
                type="checkbox"
                checked={settings.notify_at_end}
                onChange={(event) =>
                  setSettings({ ...settings, notify_at_end: event.target.checked, inherited: false })
                }
                className="h-5 w-5 accent-green-600"
              />
            </label>
          )}
        </div>

        <details className="group mt-3">
          <summary className="cursor-pointer list-none rounded-xl px-2 py-2 text-sm font-black text-green-700 hover:bg-green-50">
            + Hatırlatıcı ekle / düzenle
          </summary>
          <div className={`${!hasTarget ? "pointer-events-none opacity-45" : ""} mt-2 rounded-2xl border border-gray-100 bg-gray-50 p-3`}>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((offset) => {
                const selected = settings.offsets.includes(offset);
                return (
                  <button
                    key={offset}
                    type="button"
                    onClick={() => toggleOffset(offset)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-black transition ${
                      selected
                        ? "border-green-600 bg-green-600 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:border-green-300"
                    }`}
                  >
                    {selected ? "✓ " : ""}{labelForOffset(offset)}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="43200"
                value={customAmount}
                onChange={(event) => setCustomAmount(event.target.value)}
                className="w-16 rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs font-bold outline-none focus:border-green-400"
              />
              <select
                value={customUnit}
                onChange={(event) => setCustomUnit(event.target.value as typeof customUnit)}
                className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold outline-none focus:border-green-400"
              >
                <option value="minutes">dakika</option>
                <option value="hours">saat</option>
                <option value="days">gün</option>
              </select>
              <button
                type="button"
                onClick={addCustom}
                className="rounded-xl border border-green-200 bg-white px-3 py-2 text-xs font-black text-green-700 hover:bg-green-50"
              >
                Ekle
              </button>
            </div>
          </div>
        </details>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <p className={`min-w-0 text-xs font-bold ${
            message?.includes("kaydedildi") ? "text-green-700" : message ? "text-red-700" : "text-gray-400"
          }`}>
            {message || "Yalnızca sana ait."}
          </p>
          <button
            type="button"
            onClick={save}
            disabled={!hasTarget || isSaving}
            className="shrink-0 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`${compact ? "rounded-2xl p-4" : "rounded-3xl p-5"} border border-amber-200 bg-amber-50/50`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
            ⏱ Kişisel Hatırlatıcılar
          </p>
          <h3 className={`${compact ? "mt-1 text-base" : "mt-2 text-lg"} font-black text-gray-950`}>{title}</h3>
          <p className="mt-1 text-sm leading-6 text-gray-600">
            {hasTarget
              ? "Bu tarih için yalnız sana ait hatırlatıcıları seç. Tarih değişirse saatler otomatik yeniden hesaplanır."
              : resourceType === "plan"
                ? "Planın kesin tarihi oluştuğunda hatırlatıcılar devreye girer."
                : "Önce Tohum için bir hedef tarih belirle."}
          </p>
          {targetLabel && <p className="mt-1 text-xs font-bold text-gray-500">{targetLabel}</p>}
        </div>
        {settings.inherited && (
          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-amber-800 shadow-sm">
            Varsayılan ayarların
          </span>
        )}
      </div>

      <div className={`${compact ? "mt-3" : "mt-5"} ${!hasTarget ? "pointer-events-none opacity-45" : ""}`}>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Ne kadar önce?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((offset) => {
            const selected = settings.offsets.includes(offset);
            return (
              <button
                key={offset}
                type="button"
                onClick={() => toggleOffset(offset)}
                className={`rounded-full border px-3 py-2 text-xs font-black transition ${
                  selected
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:border-amber-300"
                }`}
              >
                {selected ? "✓ " : ""}{labelForOffset(offset)}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min="1"
            max="43200"
            value={customAmount}
            onChange={(event) => setCustomAmount(event.target.value)}
            className="w-20 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-amber-400"
          />
          <select
            value={customUnit}
            onChange={(event) => setCustomUnit(event.target.value as typeof customUnit)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-amber-400"
          >
            <option value="minutes">dakika</option>
            <option value="hours">saat</option>
            <option value="days">gün</option>
          </select>
          <button
            type="button"
            onClick={addCustom}
            className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-black text-amber-800 hover:bg-amber-100"
          >
            + Özel ekle
          </button>
        </div>

        {settings.offsets.some((offset) => !PRESETS.includes(offset as (typeof PRESETS)[number])) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {settings.offsets
              .filter((offset) => !PRESETS.includes(offset as (typeof PRESETS)[number]))
              .map((offset) => (
                <button
                  type="button"
                  key={offset}
                  onClick={() => toggleOffset(offset)}
                  className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-800"
                >
                  {labelForOffset(offset)} ×
                </button>
              ))}
          </div>
        )}

        <div className={`${compact ? "mt-3" : "mt-5"} grid gap-2 sm:grid-cols-2`}>
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4">
            <span>
              <span className="block text-sm font-black text-gray-950">
                {resourceType === "plan" ? "Etkinlik başladığında" : "Hedef zamanı geldiğinde"}
              </span>
              <span className="mt-1 block text-xs text-gray-500">Anlık bildirim + popup</span>
            </span>
            <input
              type="checkbox"
              checked={settings.notify_at_start}
              onChange={(event) =>
                setSettings({ ...settings, notify_at_start: event.target.checked, inherited: false })
              }
              className="h-5 w-5 accent-green-600"
            />
          </label>

          {resourceType === "plan" && (
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4">
              <span>
                <span className="block text-sm font-black text-gray-950">Planlanan süre dolduğunda</span>
                <span className="mt-1 block text-xs text-gray-500">Activity Room’a dönüp sonucu kapatman için</span>
              </span>
              <input
                type="checkbox"
                checked={settings.notify_at_end}
                onChange={(event) =>
                  setSettings({ ...settings, notify_at_end: event.target.checked, inherited: false })
                }
                className="h-5 w-5 accent-green-600"
              />
            </label>
          )}
        </div>

        {resourceType === "seed" && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className={`rounded-2xl border border-gray-200 bg-white ${compact ? "p-3" : "p-4"}`}>
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Hedef saati</span>
              <input
                type="time"
                value={settings.seed_target_time}
                onChange={(event) =>
                  setSettings({ ...settings, seed_target_time: event.target.value, inherited: false })
                }
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold outline-none focus:border-amber-400"
              />
              <span className="mt-2 block text-[11px] leading-5 text-gray-500">
                Tohum hedefleri tarih bazlı olduğu için kişisel hatırlatma saatin burada tutulur.
              </span>
            </label>

            <label className={`rounded-2xl border border-gray-200 bg-white ${compact ? "p-3" : "p-4"}`}>
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Saat dilimi</span>
              <input
                value={settings.timezone}
                onChange={(event) =>
                  setSettings({ ...settings, timezone: event.target.value, inherited: false })
                }
                placeholder="Europe/Istanbul"
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold outline-none focus:border-amber-400"
              />
              <span className="mt-2 block text-[11px] leading-5 text-gray-500">Örn. Europe/Istanbul</span>
            </label>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            15 dakika hatırlatıcısı Activity’lerde varsayılan olarak açıktır; istersen kişisel olarak değiştirebilirsin.
          </p>
          <button
            type="button"
            onClick={save}
            disabled={!hasTarget || isSaving}
            className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Kaydediliyor…" : "Hatırlatıcıları Kaydet"}
          </button>
        </div>
      </div>

      {message && (
        <p className={`mt-4 text-xs font-bold ${message.includes("kaydedildi") ? "text-green-700" : "text-red-700"}`}>
          {message}
        </p>
      )}
    </section>
  );
}
