"use client";

import { useEffect, useState } from "react";

import IntentLinksEditor from "@/components/intents/IntentLinksEditor";
import {
  serializeIntentLinks,
  type IntentLinkInput,
} from "@/utils/intentLinks";
import { supabase } from "@/utils/supabase/client";

type PlanPublicContentPayload = {
  plan_id: string;
  plan_status: string;
  description: string | null;
  meeting_point: string | null;
  meeting_point_visibility: "members" | "public";
  activity_location_name: string | null;
  activity_location_visibility: "members" | "public";
  source_intent_id: string | null;
  links: Array<{
    id?: string;
    link_type: IntentLinkInput["linkType"];
    label: string | null;
    url: string;
    sort_order: number;
  }>;
};

type Props = {
  planId: string;
  canManage: boolean;
};

export default function PlanPublicContentEditor({
  planId,
  canManage,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState("");
  const [meetingPoint, setMeetingPoint] = useState("");
  const [meetingVisibility, setMeetingVisibility] =
    useState<"members" | "public">("members");
  const [links, setLinks] = useState<IntentLinkInput[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setErrorMessage(null);

      const { data, error } = await supabase.rpc(
        "get_my_plan_public_content",
        {
          p_plan_id: planId,
        }
      );

      if (!active) return;

      if (error || !data) {
        setErrorMessage(
          "Görünen bilgiler yüklenemedi. Veriler değiştirilmedi."
        );
        setLoading(false);
        return;
      }

      const payload = data as PlanPublicContentPayload;

      setDescription(payload.description ?? "");
      setMeetingPoint(payload.meeting_point ?? "");
      setMeetingVisibility(
        payload.meeting_point_visibility === "public"
          ? "public"
          : "members"
      );

      setLinks(
        (payload.links ?? []).map((link) => ({
          id: link.id,
          linkType: link.link_type,
          label: link.label ?? "",
          url: link.url,
        }))
      );

      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [planId]);

  async function save() {
    if (!canManage || saving) return;

    setSaving(true);
    setNotice(null);
    setErrorMessage(null);

    const { error } = await supabase.rpc(
      "update_my_plan_public_content",
      {
        p_plan_id: planId,
        p_description: description,
        p_meeting_point_visibility: meetingVisibility,
        p_links: serializeIntentLinks(links),
      }
    );

    if (error) {
      setErrorMessage(
        "Bilgiler kaydedilemedi. Mevcut bilgiler korunuyor."
      );
      setSaving(false);
      return;
    }

    setNotice(
      "Görünen bilgiler güncellendi. Görüntüleme ekranına anında yansır."
    );
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-500">
        Görünen bilgiler yükleniyor…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="grid gap-6">
        <div>
          <label
            htmlFor={`plan-public-description-${planId}`}
            className="text-sm font-bold text-gray-950"
          >
            Açıklama
          </label>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Katılmayı düşünen kişinin bu Aktiviteyi anlaması için gereken
            ayrıntıları yaz. Planlama başladıktan sonra da güncellenebilir.
          </p>
          <textarea
            id={`plan-public-description-${planId}`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={!canManage || saving}
            maxLength={5000}
            rows={7}
            placeholder="Örn. Nerede buluşacağız, nasıl gideceğiz, program nedir, kimler için uygun…"
            className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-950 outline-none transition focus:border-green-400 focus:ring-4 focus:ring-green-50 disabled:bg-gray-50"
          />
          <p className="mt-1 text-right text-[11px] text-gray-400">
            {description.length}/5000
          </p>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-gray-950">
                Buluşma noktası görünürlüğü
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Buluşma noktası:{" "}
                <strong className="text-gray-700">
                  {meetingPoint || "Henüz girilmedi"}
                </strong>
              </p>
            </div>

            <select
              value={meetingVisibility}
              onChange={(event) =>
                setMeetingVisibility(
                  event.target.value === "public"
                    ? "public"
                    : "members"
                )
              }
              disabled={!canManage || saving}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
            >
              <option value="members">Sadece Plan üyeleri</option>
              <option value="public">Görüntüleyenler görebilsin</option>
            </select>
          </div>

          <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
            “Görüntüleyenler görebilsin” seçilirse yalnızca buluşma noktasının
            adı gösterilir. Tam adres, koordinat, harita bağlantısı ve özel
            ulaşım notları Plan üyelerine özel kalır.
          </div>
        </div>

        <div>
          <div className="mb-3">
            <p className="text-sm font-bold text-gray-950">
              Bağlantılar ve videolar
            </p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Resmî sayfa, bilet, organizatör, mekân, kaynak veya video ekle.
              En fazla 5 bağlantı.
            </p>
          </div>

          <IntentLinksEditor
            value={links}
            onChange={setLinks}
            disabled={!canManage || saving}
          />
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {notice && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {notice}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={!canManage || saving}
            className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Kaydediliyor…" : "Görünen bilgileri kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
