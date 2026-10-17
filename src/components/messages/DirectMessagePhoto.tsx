"use client";
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { DIRECT_PHOTO_BUCKET } from '@/services/directMessagePhotoService';

export default function DirectMessagePhoto({ path }: { path: string }) {
  const [url,setUrl] = useState<string | null>(null);
  const [error,setError] = useState(false);
  const [retry,setRetry] = useState(0);
  const [open,setOpen] = useState(false);
  const [zoom,setZoom] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let active = true;
    setError(false);
    void supabase.storage.from(DIRECT_PHOTO_BUCKET).createSignedUrl(path,900).then(result => {
      if (!active) return;
      if (result.error || !result.data?.signedUrl) setError(true);
      else setUrl(result.data.signedUrl);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [path,retry]);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  return <>
    <button type="button" aria-label={error ? 'Fotoğrafı yeniden yükle' : 'Fotoğrafı büyüt'} onClick={() => {
      setRetry(value => value + 1);
      if (!error) { setZoom(false); setOpen(true); }
    }} className="my-2 block min-h-24 w-64 max-w-full overflow-hidden rounded-xl bg-gray-100 text-sm text-emerald-800">
      {error ? <span className="block p-4">Fotoğraf açılamadı. Yeniden dene</span> : url ? <img src={url} alt="Sohbette paylaşılan fotoğraf" className="max-h-72 w-full object-contain" onError={() => setError(true)} /> : 'Fotoğraf yükleniyor…'}
    </button>
    <dialog ref={dialog} onClose={() => setOpen(false)} className="m-auto h-[95vh] w-[95vw] max-w-none rounded-xl bg-gray-950 p-4 text-white backdrop:bg-black/80">
      <div className="sticky top-0 z-10 flex justify-end gap-3 bg-gray-950 p-2">
        <button type="button" className="rounded-lg border px-4 py-2" onClick={() => setZoom(value => !value)}>{zoom ? 'Küçült' : 'Yakınlaştır'}</button>
        <button type="button" className="rounded-lg border px-4 py-2" onClick={() => setOpen(false)}>Kapat ✕</button>
      </div>
      {url ? <img src={url} alt="Paylaşılan fotoğrafın büyük görünümü" style={zoom ? { width: '180vw', maxWidth: 'none' } : { maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', margin: 'auto' }} onError={() => { setError(true); setOpen(false); }} /> : null}
    </dialog>
  </>;
}
