'use client';

import {EMPTY_WATCH_FILTERS, WATCH_ACCESS_OPTIONS, hasWatchFilters, watchPlatformLabel, type WatchFilters, type WatchPlatformOption, type WatchAccess} from '@/utils/watchFilters';

export default function WatchLibraryFilters({value, options, loading, onChange}: {
  value: WatchFilters; options: WatchPlatformOption[]; loading?: boolean; onChange: (value: WatchFilters) => void;
}) {
  const toggle = (id: string) => onChange({...value, providers: value.providers.includes(id) ? value.providers.filter(name => name !== id) : [...value.providers, id]});
  return <div className="mt-4 space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4" aria-label="İzleme filtreleri">
    <div className="grid items-start gap-3 sm:grid-cols-2">
      <details className="min-w-0 rounded-xl border border-slate-200 bg-white">
        <summary className="min-h-12 cursor-pointer p-3 text-sm font-bold text-slate-900">Platform · {value.providers.length ? `${value.providers.length} seçili` : 'Tüm platformlar'}</summary>
        <div className="max-h-64 overflow-y-auto border-t px-3 pb-2">
          {loading && !options.length ? <p role="status" className="py-3 text-sm text-slate-500">Platformlar yükleniyor…</p> : !options.length ? <p className="py-3 text-sm text-slate-500">Bu kapsamdaki kartlarda platform bilgisi bulunamadı.</p> : options.map(option => <label key={option.id} className="flex min-h-11 cursor-pointer items-center gap-3 py-2 text-sm text-slate-800">
            <input type="checkbox" checked={value.providers.includes(option.id)} onChange={() => toggle(option.id)} className="h-4 w-4 accent-emerald-600"/>{option.label}
          </label>)}
        </div>
      </details>
      <label className="min-w-0 text-xs font-bold text-slate-600">İzleme seçeneği
        <select aria-label="İzleme seçeneği" value={value.access} onChange={event => onChange({...value, access: event.target.value as WatchAccess})} className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900">
          {WATCH_ACCESS_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
    </div>
    {hasWatchFilters(value) ? <div className="flex flex-wrap items-center gap-2">
      {value.providers.map(name => <button key={name} type="button" aria-label={`${watchPlatformLabel(name)} filtresini kaldır`} onClick={() => toggle(name)} className="min-h-11 rounded-xl border border-emerald-200 bg-white px-3 text-xs font-bold text-emerald-800">{watchPlatformLabel(name)} ×</button>)}
      <button type="button" onClick={() => onChange(EMPTY_WATCH_FILTERS)} className="min-h-11 px-2 text-xs font-bold text-slate-600 underline">İzleme filtrelerini temizle</button>
    </div> : null}
    <p className="text-xs leading-5 text-slate-600">Türkiye’deki izleme seçenekleri. Birden fazla platform seçebilirsin; seçtiklerinden herhangi birinde bulunan içerikler görünür. Abonelikte izleyebileceklerin için “Aboneliğe dahil” seç.</p>
  </div>;
}
