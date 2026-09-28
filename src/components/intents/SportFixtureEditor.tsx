"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";
import type { SportFixtureOption } from "@/components/activities/SportActivityPlanningHero";

function fixtureLabel(fixture: SportFixtureOption) {
  const date = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${fixture.match_date.slice(0, 10)}T00:00:00`));

  return `${date} · ${fixture.match_name}${fixture.venue ? ` · ${fixture.venue}` : ""}`;
}

export default function SportFixtureEditor({
  intentId,
  fixtures,
}: {
  intentId: string;
  fixtures: SportFixtureOption[];
}) {
  const router = useRouter();
  const selected = fixtures.find((fixture) => fixture.selected) ?? null;
  const [fixtureId, setFixtureId] = useState(selected?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function chooseFixture(value: string) {
    setFixtureId(value);
    if (!value) return;

    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("set_intent_match_fixture_v50", {
      p_intent_id: intentId,
      p_fixture_id: value,
    });
    setBusy(false);

    if (error) {
      setMessage(error.message || "Maç seçilemedi.");
      return;
    }

    setMessage("Maç seçildi; etkinliğin tarihi güncellendi.");
    router.refresh();
  }

  async function createFixture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);

    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc(
      "create_and_select_intent_match_fixture_v51",
      {
        p_intent_id: intentId,
        p_opponent_name: String(values.get("opponent") || ""),
        p_match_date: String(values.get("date") || ""),
        p_venue: String(values.get("venue") || ""),
      }
    );
    setBusy(false);

    if (error) {
      setMessage(error.message || "Maç eklenemedi.");
      return;
    }

    setMessage("Maç eklendi ve etkinliğe bağlandı.");
    router.refresh();
  }

  return (
    <section className="mb-7 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 md:p-5">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">
        Maç / fikstür
      </p>
      <h2 className="mt-2 text-xl font-black text-gray-950">Maçını seç</h2>
      <p className="mt-1 text-sm leading-6 text-gray-600">
        Fikstürde maç varsa listeden seç. Henüz eklenmediyse rakip, tarih ve stadyum bilgilerini aşağıya gir.
      </p>

      {fixtures.length > 0 && (
        <label className="mt-4 block text-sm font-bold text-gray-700">
          Fikstürdeki maçlar
          <select
            value={fixtureId}
            disabled={busy}
            onChange={(event) => void chooseFixture(event.target.value)}
            className="mt-2 w-full rounded-xl border border-violet-200 bg-white px-3 py-3 text-sm font-semibold text-gray-950"
          >
            <option value="">Bir maç seç</option>
            {fixtures.map((fixture) => (
              <option key={fixture.id} value={fixture.id}>
                {fixtureLabel(fixture)}
              </option>
            ))}
          </select>
        </label>
      )}

      {fixtures.length === 0 && (
        <p className="mt-4 rounded-xl bg-white px-3 py-2 text-sm font-bold text-amber-700">
          Bu takım için kayıtlı yaklaşan maç yok. İlk maçı aşağıdan ekleyebilirsin.
        </p>
      )}

      <form onSubmit={createFixture} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm font-bold text-gray-700">
          Rakip takım
          <input
            name="opponent"
            required
            maxLength={120}
            placeholder="Örn. Kocaelispor"
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-gray-950"
          />
        </label>
        <label className="text-sm font-bold text-gray-700">
          Maç tarihi
          <input
            name="date"
            type="date"
            required
            min={new Date().toISOString().slice(0, 10)}
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-gray-950"
          />
        </label>
        <label className="text-sm font-bold text-gray-700 md:col-span-2">
          Stadyum / salon
          <input
            name="venue"
            maxLength={240}
            placeholder="Henüz belli değilse boş bırakabilirsin"
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-gray-950"
          />
        </label>
        <button
          disabled={busy}
          className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-700 disabled:opacity-50 md:col-span-2"
        >
          {busy ? "Kaydediliyor…" : "Maçı ekle ve seç"}
        </button>
      </form>

      {message && <p className="mt-3 text-sm font-bold text-violet-700">{message}</p>}
    </section>
  );
}
