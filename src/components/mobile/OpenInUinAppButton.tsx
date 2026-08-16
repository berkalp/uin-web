"use client";

import { useEffect, useState } from "react";

export default function OpenInUinAppButton({
  resourceId,
}: {
  resourceId: string;
}) {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(/Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent));
  }, []);

  if (!mobile) return null;

  function openApp() {
    const encoded = encodeURIComponent(resourceId);
    const fallback = encodeURIComponent(window.location.href);

    if (/Android/i.test(window.navigator.userAgent)) {
      window.location.href =
        `intent://activities/${encoded}` +
        `#Intent;scheme=uin;package=onl.uin.app;` +
        `S.browser_fallback_url=${fallback};end`;
      return;
    }

    window.location.href = `uin://activities/${encoded}`;
  }

  return (
    <button
      type="button"
      onClick={openApp}
      className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
    >
      UIN uygulamasında aç
    </button>
  );
}
