"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { supabase } from "@/utils/supabase/client";

type ReactionType = "save" | "paw";

type ReactorRow = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  reacted_at: string;
};

type Props = {
  open: boolean;
  intentId: string;
  reactionType: ReactionType;
  count: number;
  onClose: () => void;
};

function initial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

export default function IntentReactionPeopleModal({
  open,
  intentId,
  reactionType,
  count,
  onClose,
}: Props) {
  const [rows, setRows] = useState<ReactorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setRows([]);
    setErrorMessage(null);
    setLoading(true);

    void (async () => {
      const { data, error } = await supabase.rpc("get_my_intent_reactors", {
        p_intent_id: intentId,
        p_reaction_type: reactionType,
      });

      if (cancelled) return;

      if (error) {
        console.error("Intent reactor list failed:", error);
        setErrorMessage("Kişiler yüklenemedi.");
        setLoading(false);
        return;
      }

      const nextRows = Array.isArray(data)
        ? data.flatMap((raw) => {
            if (!raw || typeof raw !== "object") return [];
            const row = raw as Record<string, unknown>;
            const userId = typeof row.user_id === "string" ? row.user_id : "";
            const reactedAt = typeof row.reacted_at === "string" ? row.reacted_at : "";
            if (!userId || !reactedAt) return [];

            return [
              {
                user_id: userId,
                full_name: typeof row.full_name === "string" ? row.full_name : null,
                username: typeof row.username === "string" ? row.username : null,
                avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
                reacted_at: reactedAt,
              } satisfies ReactorRow,
            ];
          })
        : [];

      setRows(nextRows);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [intentId, open, reactionType]);

  if (!open || typeof document === "undefined") return null;

  const title = reactionType === "save" ? "Kaydedenler" : "Patileyenler";
  const empty =
    reactionType === "save"
      ? "Henüz bu Niyeti kaydeden yok."
      : "Henüz bu Niyeti patileyen yok.";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${title} · ${count}`}
        className="w-full max-w-md overflow-hidden rounded-[26px] border border-gray-200 bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-green-700">
              NİYET ETKİLEŞİMİ
            </p>
            <h2 className="mt-1 text-lg font-black text-gray-950">
              {title} · {count}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 bg-white text-lg font-bold text-gray-600 transition hover:bg-gray-50"
          >
            ×
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3">
          {loading ? (
            <div className="px-4 py-10 text-center text-sm font-semibold text-gray-500">
              Kişiler yükleniyor…
            </div>
          ) : errorMessage ? (
            <div className="rounded-2xl bg-red-50 px-4 py-5 text-sm font-semibold text-red-700">
              {errorMessage}
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm font-semibold text-gray-500">
              {empty}
            </div>
          ) : (
            <div className="grid gap-1">
              {rows.map((row) => {
                const label = row.full_name || row.username || "UIN üyesi";
                const content = (
                  <>
                    {row.avatar_url ? (
                      <img
                        src={row.avatar_url}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-green-50 text-xs font-black text-green-700">
                        {initial(label)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-gray-950">
                        {label}
                      </span>
                      {row.username ? (
                        <span className="mt-0.5 block truncate text-xs font-semibold text-gray-400">
                          @{row.username}
                        </span>
                      ) : null}
                    </span>
                    {row.username ? (
                      <span className="text-sm font-bold text-gray-300">›</span>
                    ) : null}
                  </>
                );

                return row.username ? (
                  <Link
                    key={row.user_id}
                    href={`/u/${encodeURIComponent(row.username)}`}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-gray-50"
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    key={row.user_id}
                    className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}
