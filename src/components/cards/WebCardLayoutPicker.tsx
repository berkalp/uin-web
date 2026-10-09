"use client";

import { useSyncExternalStore } from "react";

export type WebCardLayout = "compact" | "square" | "large";
const STORAGE_KEY = "uin:web-card-layout:v1";
const EVENT_NAME = "uin:web-card-layout-change";
const OPTIONS: Array<{ value: WebCardLayout; label: string; icon: string }> = [
  { value: "compact", label: "Dikdörtgen kartlar", icon: "▯" },
  { value: "square", label: "Kare kartlar", icon: "□" },
  { value: "large", label: "Büyük kartlar", icon: "▤" },
];

function isLayout(value: string | null): value is WebCardLayout {
  return value === "compact" || value === "square" || value === "large";
}

function applyLayout(layout: WebCardLayout) {
  document.documentElement.dataset.uinCardLayout = layout;
}

function getStoredLayout(): WebCardLayout {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return isLayout(saved) ? saved : "large";
}

function subscribe(onStoreChange: () => void) {
  const sync = () => {
    applyLayout(getStoredLayout());
    onStoreChange();
  };

  applyLayout(getStoredLayout());
  window.addEventListener("storage", sync);
  window.addEventListener(EVENT_NAME, sync);
  return () => {
    window.removeEventListener("storage", sync);
    window.removeEventListener(EVENT_NAME, sync);
  };
}

export default function WebCardLayoutPicker({ className = "" }: { className?: string }) {
  const layout = useSyncExternalStore(subscribe, getStoredLayout, () => "large");

  function select(next: WebCardLayout) {
    applyLayout(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
  }

  return <div className={`hidden rounded-2xl border border-gray-200 bg-white p-1 shadow-sm sm:inline-flex ${className}`} role="group" aria-label="Kart boyutu">
    {OPTIONS.map(option => {
      const active = layout === option.value;
      return <button key={option.value} type="button" onClick={() => select(option.value)} aria-label={option.label} aria-pressed={active} title={option.label} className={`grid h-10 w-11 place-items-center rounded-xl border text-xl transition ${active ? "border-emerald-600 bg-emerald-600 text-white shadow-sm" : "border-transparent text-slate-500 hover:bg-emerald-50 hover:text-emerald-800"}`}><span aria-hidden="true">{option.icon}</span></button>;
    })}
  </div>;
}
