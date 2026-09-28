"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/utils/supabase/client";

type LandingPhoto = {
  id: string;
  url: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
  photoUrl: string;
};

const FALLBACK_PHOTO: LandingPhoto = {
  id: "WbxhqcHG5Jc",
  url: "https://images.unsplash.com/photo-1719178071673-d5587c0b934e?auto=format&fit=crop&w=2400&q=86",
  alt: "İstanbul vapurunda gün batımında yolcular",
  photographer: "Kamil Kalkan",
  photographerUrl: "https://unsplash.com/@kamilklkn?utm_source=uin&utm_medium=referral",
  photoUrl: "https://unsplash.com/photos/WbxhqcHG5Jc?utm_source=uin&utm_medium=referral",
};

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.23-.2-1.78h-9.2v3.34h5.4a4.6 4.6 0 0 1-2 3.02l-.03.11 2.9 2.24.2.02c1.84-1.7 2.93-4.2 2.93-6.95Z" />
      <path fill="#34A853" d="M12.2 21.8c2.64 0 4.85-.87 6.47-2.62l-3.08-2.37c-.82.55-1.93.94-3.39.94a5.88 5.88 0 0 1-5.57-4.06l-.1.01-3.02 2.34-.04.1A9.78 9.78 0 0 0 12.2 21.8Z" />
      <path fill="#FBBC05" d="M6.63 13.69a6.05 6.05 0 0 1-.33-1.96c0-.68.12-1.34.32-1.96v-.12L3.56 7.28l-.1.05a9.8 9.8 0 0 0 0 8.81l3.17-2.45Z" />
      <path fill="#EA4335" d="M12.2 5.72c1.84 0 3.08.8 3.8 1.46l2.73-2.66C17.05 2.96 14.84 2 12.2 2a9.78 9.78 0 0 0-8.73 5.33l3.15 2.44A5.9 5.9 0 0 1 12.2 5.72Z" />
    </svg>
  );
}

function randomPhoto(photos: LandingPhoto[]) {
  if (photos.length === 0) return FALLBACK_PHOTO;

  const values = new Uint32Array(1);
  window.crypto.getRandomValues(values);
  return photos[values[0] % photos.length] ?? FALLBACK_PHOTO;
}

export default function Home() {
  const [photo, setPhoto] = useState<LandingPhoto>(FALLBACK_PHOTO);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPhoto() {
      try {
        const response = await fetch("/api/landing-photo");
        if (!response.ok) return;

        const payload = (await response.json()) as { photos?: LandingPhoto[] };
        if (active && payload.photos?.length) {
          setPhoto(randomPhoto(payload.photos));
        }
      } catch {
        // The permanent Istanbul fallback keeps the entrance usable.
      }
    }

    loadPhoto();

    return () => {
      active = false;
    };
  }, []);

  async function signInWithGoogle() {
    if (isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/auth/callback",
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error("Google giriş adresi oluşturulamadı.");

      window.location.assign(data.url);
    } catch (error) {
      console.error("Google sign-in error:", error);
      setErrorMessage("Google ile giriş şu anda başlatılamadı.");
      setIsLoading(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#07100b] text-white">
      <div
        key={photo.id}
        role="img"
        aria-label={photo.alt}
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
        style={{ backgroundImage: "url(" + JSON.stringify(photo.url) + ")" }}
      />

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,13,8,0.72)_0%,rgba(2,12,8,0.22)_48%,rgba(2,10,7,0.42)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.04)_48%,rgba(0,0,0,0.58)_100%)]" />

      <section className="relative z-10 grid min-h-dvh place-items-center px-5 py-28">
        <div className="flex w-full max-w-sm flex-col items-center gap-7 sm:gap-8">
          <img
            src="/uin-logo-outline.png"
            alt="UIN"
            className="h-auto w-40 select-none object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)] sm:w-48"
          />
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={isLoading}
            className="inline-flex min-h-16 w-full items-center justify-center gap-4 rounded-full bg-white px-8 py-4 text-base font-bold text-[#151a17] shadow-[0_20px_60px_rgba(0,0,0,0.28)] transition hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-[0_24px_70px_rgba(0,0,0,0.34)] disabled:cursor-wait disabled:opacity-70 sm:text-lg"
          >
            <GoogleMark />
            <span>{isLoading ? "Google açılıyor…" : "Google ile giriş yap"}</span>
          </button>

          {errorMessage && (
            <p role="alert" className="mt-4 rounded-full bg-red-950/75 px-4 py-2 text-center text-sm font-medium text-white backdrop-blur">
              {errorMessage}
            </p>
          )}
        </div>
      </section>

      <p className="absolute bottom-5 left-5 z-10 text-[11px] font-medium text-white/70 sm:bottom-7 sm:left-8">
        Fotoğraf:{" "}
        <a href={photo.photographerUrl} target="_blank" rel="noreferrer" className="underline decoration-white/30 underline-offset-4 hover:text-white">
          {photo.photographer}
        </a>
        {" · "}
        <a href={photo.photoUrl} target="_blank" rel="noreferrer" className="underline decoration-white/30 underline-offset-4 hover:text-white">
          Unsplash
        </a>
      </p>
    </main>
  );
}
