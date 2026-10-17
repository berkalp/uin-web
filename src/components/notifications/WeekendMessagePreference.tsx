"use client";
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/utils/supabase/client';

export default function WeekendMessagePreference() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const saving = useRef(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    setError('');
    void (async () => {
      try {
        const result = await supabase.rpc('get_my_uin_weekend_preference').abortSignal(controller.signal);
        if (result.error || typeof result.data !== 'boolean') throw new Error();
        if (active) setEnabled(result.data);
      } catch {
        if (active) setError('Haftalık mesaj ayarı yüklenemedi.');
      } finally { clearTimeout(timeout); }
    })();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [retry]);
  async function toggle() {
    if (enabled === null || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const result = await supabase.rpc('save_my_uin_weekend_preference', { p_enabled: !enabled }).abortSignal(controller.signal);
      if (result.error || typeof result.data !== 'boolean') throw new Error();
      setEnabled(result.data);
    } catch {
      setError('Tercihin doğrulanamadı. Yeniden yükleyip kontrol edebilirsin.');
    } finally { clearTimeout(timeout); saving.current = false; setBusy(false); }
  }
  return <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
    <h2 className="font-bold text-emerald-950">Berkalp’ten hafta sonu mesajı 💚</h2>
    <p className="mt-2 text-sm text-emerald-900">Her cumartesi Türkiye saatiyle 12.00’de mesaj ve telefon bildirimi al. Kapatsan da Berkalp’e yazabilirsin.</p>
    <button type="button" role="switch" aria-label="Berkalp’ten haftalık mesaj ve bildirim" aria-checked={enabled === true} disabled={enabled === null || busy} onClick={() => void toggle()} className="mt-3 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
      {busy ? 'Kaydediliyor…' : enabled === null ? 'Yükleniyor…' : enabled ? 'Açık · Kapat' : 'Kapalı · Aç'}
    </button>
    {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error} <button type="button" onClick={() => setRetry(value => value + 1)} className="underline">Yeniden dene</button></p> : null}
  </section>;
}
