"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export default function CardQuickDetails({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} title="Detay gör" aria-label={`${title}: Detay gör`} className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v1" /></svg>
    </button>
    {open && <DetailsDialog title={title} subtitle={subtitle} onClose={() => setOpen(false)}>{children}</DetailsDialog>}
  </>;
}
function DetailsDialog({ title, subtitle, children, onClose }: { title: string; subtitle?: ReactNode; children?: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return createPortal(<dialog ref={ref} onClose={onClose} aria-label={`${title}: Detaylar`} className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl bg-white p-5 text-gray-900 shadow-xl backdrop:bg-black/35">
    <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{title}</h2><div className="mt-1 text-sm text-gray-500">{subtitle}</div></div><button type="button" onClick={() => ref.current?.close()} aria-label="Kapat" className="h-9 w-9 shrink-0 rounded-xl bg-gray-100">×</button></div>
    {children}
  </dialog>, document.body);
}
