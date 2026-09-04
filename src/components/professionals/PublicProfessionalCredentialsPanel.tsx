"use client";

import { useEffect, useState } from "react";

import VerificationMark from "@/components/professionals/VerificationMark";
import { setMyProfileDisplayOrder } from "@/services/profileDisplayOrderService";
import type {
  PublicProfessionalCredential,
  PublicProfessionalStatus,
} from "@/utils/professionals";

type PublicProfessionalCredentialsPanelProps = {
  status: PublicProfessionalStatus;
  isOwner?: boolean;
};

const PAGE_SIZE = 6;

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function PublicProfessionalCredentialsPanel({
  status,
  isOwner = false,
}: PublicProfessionalCredentialsPanelProps) {
  const [credentials, setCredentials] = useState(status.credentials);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [reordering, setReordering] = useState(false);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);

  useEffect(() => {
    setCredentials(status.credentials);
    setVisibleCount(PAGE_SIZE);
  }, [status.credentials]);

  const visibleCredentials = reordering
    ? credentials
    : credentials.slice(0, visibleCount);

  const hasMoreCredentials =
    !reordering && visibleCount < credentials.length;

  const hasExpandedCredentials =
    !reordering && credentials.length > PAGE_SIZE;

  async function moveCredential(
    credential: PublicProfessionalCredential,
    direction: -1 | 1
  ) {
    const index = credentials.findIndex((item) => item.id === credential.id);
    const targetIndex = index + direction;

    if (index < 0 || targetIndex < 0 || targetIndex >= credentials.length) {
      return;
    }

    const previous = credentials;
    const next = [...credentials];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setCredentials(next);
    setOrderMessage("Sıralama kaydediliyor…");

    try {
      await setMyProfileDisplayOrder(
        "credential",
        next.map((item) => item.id)
      );
      setOrderMessage("Sıralama kaydedildi");
    } catch (error) {
      setCredentials(previous);
      setOrderMessage(
        error instanceof Error ? error.message : "Sıralama kaydedilemedi."
      );
    }
  }

  if (!status.identity_verified && credentials.length === 0) {
    return null;
  }

  return (
    <section className="mt-0 bg-transparent p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Doğrulanmış bilgiler
          </p>

          <h2 className="mt-1.5 text-xl font-bold text-gray-950">
            Profesyonel yeterlilikler
          </h2>

          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-gray-500">
            Bu yeterlilikler belirli bir aktivite veya kategori için doğrulanmıştır. Gerçek ortak deneyimlerden oluşan itibardan ayrı değerlendirilir.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status.identity_verified && (
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">
              <VerificationMark compact />
              Kimlik doğrulandı
            </div>
          )}

          {isOwner && credentials.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setReordering((value) => !value);
                setOrderMessage(null);
              }}
              className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                reordering
                  ? "border-gray-950 bg-gray-950 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {reordering ? "Sıralamayı bitir" : "Sırala"}
            </button>
          )}
        </div>
      </div>

      {reordering && (
        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs text-gray-600">
          Profilde gösterilecek sırayı kartlardaki oklarla değiştirebilirsin.
          {orderMessage && (
            <span className="ml-2 font-bold text-blue-800">{orderMessage}</span>
          )}
        </div>
      )}

      {credentials.length > 0 && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {visibleCredentials.map((credential) => {
              const contextLabel =
                credential.activity_name || credential.category_name;
              const expiryLabel = formatDate(credential.expires_at);
              const globalIndex = credentials.findIndex(
                (item) => item.id === credential.id
              );

              return (
                <article
                  key={credential.id}
                  className="relative min-w-0 rounded-2xl border border-blue-100 bg-blue-50/60 p-3"
                >
                  {reordering && (
                    <div className="absolute right-2 top-2 flex gap-1 rounded-lg bg-white/90 p-0.5 shadow-sm">
                      <button
                        type="button"
                        aria-label={`${credential.professional_title || credential.role_name} önceye taşı`}
                        disabled={globalIndex <= 0}
                        onClick={() => void moveCredential(credential, -1)}
                        className="grid h-6 w-6 place-items-center rounded-md text-[10px] font-black hover:bg-gray-100 disabled:opacity-25"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        aria-label={`${credential.professional_title || credential.role_name} sonraya taşı`}
                        disabled={globalIndex >= credentials.length - 1}
                        onClick={() => void moveCredential(credential, 1)}
                        className="grid h-6 w-6 place-items-center rounded-md text-[10px] font-black hover:bg-gray-100 disabled:opacity-25"
                      >
                        →
                      </button>
                    </div>
                  )}

                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-5 w-5"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
                      <path d="M6 5H4v2a4 4 0 0 0 4 4" />
                      <path d="M18 5h2v2a4 4 0 0 1-4 4" />
                      <path d="M12 12v4" />
                      <path d="M8 20h8" />
                    </svg>
                  </span>

                  <p className="mt-3 line-clamp-2 text-sm font-bold leading-5 text-gray-950">
                    {credential.professional_title || credential.role_name}
                  </p>

                  {credential.professional_title && (
                    <p className="mt-1 truncate text-[11px] font-semibold text-blue-800">
                      {credential.role_name}
                    </p>
                  )}

                  <p className="mt-2 truncate text-[11px] text-gray-600">
                    {contextLabel}
                  </p>

                  <div className="mt-3 border-t border-blue-100 pt-2 text-[10px] leading-4 text-gray-500">
                    <p className="truncate">Veren kurum: {credential.issuer}</p>
                    {expiryLabel && (
                      <p className="mt-0.5 truncate">Geçerlilik {expiryLabel}</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>


        {hasExpandedCredentials && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() =>
                setVisibleCount((current) =>
                  hasMoreCredentials
                    ? Math.min(current + PAGE_SIZE, credentials.length)
                    : PAGE_SIZE
                )
              }
              className="rounded-2xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition hover:border-green-300 hover:bg-green-50 hover:text-green-800"
            >
              {hasMoreCredentials ? "Devamını gör" : "Daha az göster"}
            </button>
          </div>
        )}

        </>
      )}
    </section>
  );
}
