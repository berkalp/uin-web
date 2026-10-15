"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode, type ComponentProps } from 'react';
import { supabase } from '@/utils/supabase/client';
import { matchesLibraryCategory, readLibraryCategoryIndex, type LibraryCategoryIndex } from '@/utils/libraryCategoryFilter';
import PublicSeedsPanel from '@/components/seeds/PublicSeedsPanel';
import ProfileActivityTabs from '@/components/profile/ProfileActivityTabs';

type Category = { id: string; label: string; icon: string };
type Filter = { category: string; setCategory: (value: string) => void; types: Category[]; ready: boolean; error: boolean; retry: () => void; index: LibraryCategoryIndex | null };
const Context = createContext<Filter | null>(null);

export function ProfileCategoryProvider({ targetIds, eventIds, viewerId, children }: { targetIds: string[]; eventIds: string[]; viewerId: string; children: ReactNode }) {
  const [category, setCategory] = useState('');
  const [types, setTypes] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState<{ key: string; index: LibraryCategoryIndex } | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([viewerId, [...new Set(targetIds)].sort(), [...new Set(eventIds)].sort()]);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    void (async () => {
      try {
        const response = await supabase.from('uin_content_types').select('id,label,icon').eq('active', true).order('position').order('label').abortSignal(controller.signal);
        if (response.error) throw response.error;
        if (!controller.signal.aborted) setTypes(response.data ?? []);
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { clearTimeout(timeout); }
    })();
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [revision]);
  const ready = !category || loaded?.key === key;
  useEffect(() => {
    if (ready) return;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); if (active) setError(true); }, 12000);
    setError(false);
    void readLibraryCategoryIndex(supabase, targetIds, eventIds, controller.signal)
      .then(index => { if (active) setLoaded({ key, index }); })
      .catch(() => { if (active) setError(true); })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [ready, key, revision]);
  const filter = useMemo(() => ({ category, setCategory, types, ready, error, retry: () => {setError(false);setRevision(value => value + 1);}, index: loaded?.key === key ? loaded.index : null }), [category, types, ready, error, loaded, key]);
  return <Context.Provider value={filter}>{children}</Context.Provider>;
}

export function ProfileCategoryControls({ sections }: { sections: { label: string; href: string; ids: string[]; kind: 'seed' | 'event' }[] }) {
  const filter = useContext(Context)!;
  return <div className="mt-6">
    <label className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-4 text-sm font-bold">
      Kategori
      <select aria-label="Profil kategorisi" value={filter.category} onChange={event => filter.setCategory(event.target.value)} className="min-h-11 min-w-48 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-slate-900">
        <option value="">Tümü</option>
        {filter.types.map(type => <option key={type.id} value={type.id}>{type.icon} {type.label}</option>)}
      </select>
      <span className="w-full text-xs font-normal text-slate-500">Niyetleri, etkinlikleri ve deneyimleri birlikte filtreler.</span>
    </label>
    {!filter.ready && !filter.error ? <p role="status" className="mt-3 text-sm text-emerald-700">Kategori bilgileri yükleniyor…</p> : null}
    {filter.error ? <button onClick={filter.retry} className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Kategori bilgileri yüklenemedi. Tekrar dene veya Tümü’nü seç.</button> : null}
    <nav aria-label="Profil bölümleri" className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
      {sections.map(section => {
        const count = section.ids.filter(id => matchesLibraryCategory(filter.category, [id], (section.kind === 'seed' ? filter.index?.targets : filter.index?.events) ?? {})).length;
        return <a key={section.href} href={section.href} className="rounded-2xl border border-gray-200 bg-white px-3 py-4 text-center hover:border-emerald-300"><p className="text-2xl font-bold text-slate-900">{filter.ready ? count : '…'}</p><p className="mt-1 text-xs text-slate-600">{section.label}</p></a>;
      })}
    </nav>
  </div>;
}

export function CategoryPublicSeedsPanel(props: ComponentProps<typeof PublicSeedsPanel>) {
  const filter = useContext(Context);
  if (!filter?.ready) return null;
  return <PublicSeedsPanel key={filter.category} {...props} seeds={props.seeds.filter(seed => matchesLibraryCategory(filter.category, [seed.canonical_target_id], filter.index?.targets ?? {}))} />;
}

export function CategoryProfileActivityTabs(props: ComponentProps<typeof ProfileActivityTabs>) {
  const filter = useContext(Context);
  if (!filter?.ready) return null;
  const matches = (card: typeof props.hostedCards[number]) => matchesLibraryCategory(filter.category, [card.plan_id, card.resource_id, card.intent_id], filter.index?.events ?? {});
  return <ProfileActivityTabs key={filter.category} {...props} hostedCards={props.hostedCards.filter(matches)} participatingCards={props.participatingCards.filter(matches)} />;
}
