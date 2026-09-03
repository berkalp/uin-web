"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { supabase } from "../../utils/supabase/client";

type PlanStatus = "forming" | "planned" | "completed" | "cancelled";
type RoomPhase = "planning" | "activity";
type ActorRole = "host" | "co_host" | "participant";

export type CancelledPlanRecoveryOption = {
  intent_id: string;
  relationship: string;
  end_date: string;
  intent_status: string;
  matching_status: string;
  recruitment_status: string;
  already_reopened: boolean;
  can_reopen: boolean;
  recovery_reason: string;
};

type Props = {
  planId: string;
  activityLabel: string;
  planStatus: PlanStatus;
  roomPhase: RoomPhase;
  actorRole: ActorRole;
  isActiveMember: boolean;
  recoveryOptions: CancelledPlanRecoveryOption[];
};

type CancelReason =
  | "schedule_conflict"
  | "insufficient_participation"
  | "venue_or_event_cancelled"
  | "weather_or_safety"
  | "personal_reason"
  | "other";

type LeaveReason =
  | "schedule_changed"
  | "transport_problem"
  | "cost"
  | "personal_reason"
  | "no_longer_interested"
  | "other";

const CANCEL_REASONS: Array<{ value: CancelReason; label: string }> = [
  { value: "schedule_conflict", label: "Tarih / program uyuşmazlığı" },
  { value: "insufficient_participation", label: "Yeterli katılım olmadı" },
  { value: "venue_or_event_cancelled", label: "Mekân / etkinlik iptal edildi" },
  { value: "weather_or_safety", label: "Hava / güvenlik" },
  { value: "personal_reason", label: "Kişisel neden" },
  { value: "other", label: "Diğer" },
];

const LEAVE_REASONS: Array<{ value: LeaveReason; label: string }> = [
  { value: "schedule_changed", label: "Programım değişti" },
  { value: "transport_problem", label: "Ulaşım problemi" },
  { value: "cost", label: "Maliyet / bütçe" },
  { value: "personal_reason", label: "Kişisel neden" },
  { value: "no_longer_interested", label: "Artık katılmak istemiyorum" },
  { value: "other", label: "Diğer" },
];

function errorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "İşlem tamamlanamadı.";
}

function recoveryText(reason: string) {
  if (reason === "intent_window_ended") {
    return "Bu Niyetin eski tarih aralığı geçti. Aynı Niyetten yeni tarihli bir kopya oluşturabilirsin.";
  }

  if (reason === "already_linked_elsewhere") {
    return "Bu Niyet zaten başka bir aktif Aktivite sürecine bağlı.";
  }

  if (reason === "already_reopened") {
    return "Niyetin yeniden açık.";
  }

  return "İptal edilen süreç geçmişte kalır; yalnız kendi Niyetini yeniden açarsın.";
}

export default function PlanLifecycleActions({
  planId,
  activityLabel,
  planStatus,
  roomPhase,
  actorRole,
  isActiveMember,
  recoveryOptions,
}: Props) {
  const router = useRouter();

  const [mode, setMode] = useState<"cancel" | "leave" | null>(null);
  const [cancelReason, setCancelReason] = useState<CancelReason | "">("");
  const [leaveReason, setLeaveReason] = useState<LeaveReason | "">("");
  const [note, setNote] = useState("");
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeLifecycle = planStatus === "forming" || planStatus === "planned";
  const canCancel = activeLifecycle && (actorRole === "host" || actorRole === "co_host");
  const canLeave = activeLifecycle && isActiveMember && actorRole !== "host";
  const cancelLabel = roomPhase === "planning" ? "Planlamayı İptal Et" : "Aktiviteyi İptal Et";
  const leaveLabel = roomPhase === "planning" ? "Katılımdan Ayrıl" : "Katılamayacağım";

  const sortedRecoveryOptions = useMemo(
    () => [...recoveryOptions].sort((a, b) => (a.relationship === "host_source" ? -1 : b.relationship === "host_source" ? 1 : 0)),
    [recoveryOptions]
  );

  function closeEditor() {
    if (workingKey) return;
    setMode(null);
    setCancelReason("");
    setLeaveReason("");
    setNote("");
    setError(null);
  }

  async function cancelPlan() {
    if (!cancelReason) {
      setError("İptal nedenini seç.");
      return;
    }

    if (cancelReason === "other" && !note.trim()) {
      setError("Diğer seçeneği için kısa bir açıklama yaz.");
      return;
    }

    if (!window.confirm(`${activityLabel} için ${cancelLabel.toLocaleLowerCase("tr-TR")}? Geçmiş silinmeyecek.`)) {
      return;
    }

    setWorkingKey("cancel");
    setError(null);

    try {
      const { error: rpcError } = await supabase.rpc("cancel_shared_plan_v3", {
        p_plan_id: planId,
        p_reason_code: cancelReason,
        p_reason_text: note.trim() || null,
      });

      if (rpcError) throw rpcError;

      setMode(null);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setWorkingKey(null);
    }
  }

  async function leavePlan() {
    if (!leaveReason) {
      setError("Ayrılma nedenini seç.");
      return;
    }

    if (leaveReason === "other" && !note.trim()) {
      setError("Diğer seçeneği için kısa bir açıklama yaz.");
      return;
    }

    if (!window.confirm(`${activityLabel} içinden ayrılmak istediğine emin misin? Organizasyon devam edecek.`)) {
      return;
    }

    setWorkingKey("leave");
    setError(null);

    try {
      const { error: rpcError } = await supabase.rpc("leave_shared_plan_v2", {
        p_plan_id: planId,
        p_reason_code: leaveReason,
        p_reason_text: note.trim() || null,
      });

      if (rpcError) throw rpcError;

      router.push("/timeline");
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setWorkingKey(null);
    }
  }

  async function reopenIntent(option: CancelledPlanRecoveryOption) {
    setWorkingKey(`reopen:${option.intent_id}`);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "reopen_my_intent_after_cancelled_plan",
        {
          p_plan_id: planId,
          p_intent_id: option.intent_id,
        }
      );

      if (rpcError) throw rpcError;

      if (
        typeof data === "object" &&
        data !== null &&
        "ok" in data &&
        data.ok === false
      ) {
        throw new Error(
          "message" in data && typeof data.message === "string"
            ? data.message
            : "Niyet yeniden açılamadı."
        );
      }

      router.push("/timeline?view=open");
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setWorkingKey(null);
    }
  }

  if (!canCancel && !canLeave && planStatus !== "cancelled") {
    return null;
  }

  return (
    <section className="mt-5 border-t border-gray-100 pt-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">
        Yaşam Döngüsü
      </p>

      {activeLifecycle && (
        <div className="mt-3 space-y-2">
          {canLeave && (
            <button
              type="button"
              onClick={() => {
                setMode("leave");
                setError(null);
                setNote("");
              }}
              className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-bold text-amber-900 transition hover:bg-amber-100"
            >
              {leaveLabel}
            </button>
          )}

          {canCancel && (
            <button
              type="button"
              onClick={() => {
                setMode("cancel");
                setError(null);
                setNote("");
              }}
              className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-bold text-red-700 transition hover:bg-red-100"
            >
              {cancelLabel}
            </button>
          )}

          {actorRole === "host" && (
            <p className="px-1 text-[11px] leading-5 text-gray-500">
              Kendin ayrılacaksan önce Team & Conversation bölümünden hostluğu başka bir aktif üyeye devret.
            </p>
          )}
        </div>
      )}

      {planStatus === "cancelled" && (
        <div className="mt-3 rounded-2xl border border-red-100 bg-red-50/60 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-red-700">
            İptal edildi · geçmiş korunuyor
          </p>
          <p className="mt-2 text-xs leading-5 text-red-800">
            İptal edilen süreç yeniden açılmaz. Kaynak Niyet sana aitse onu tekrar açık hale getirebilirsin.
          </p>

          {sortedRecoveryOptions.length === 0 ? (
            <p className="mt-3 text-xs font-semibold text-gray-500">
              Bu hesap için yeniden açılabilecek bağlı bir kaynak Niyet yok.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {sortedRecoveryOptions.map((option, index) => (
                <div key={option.intent_id} className="rounded-xl border border-white bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-gray-950">
                        {index === 0 ? "Kaynak Niyetin" : `Bağlı Niyet ${index + 1}`}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-gray-500">
                        {recoveryText(option.recovery_reason)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[9px] font-bold uppercase text-gray-600">
                      {option.relationship === "host_source" ? "Ana Yürüten kaynağı" : "Katılımcı kaynağı"}
                    </span>
                  </div>

                  {option.already_reopened ? (
                    <Link
                      href="/timeline?view=open"
                      className="mt-3 inline-flex rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white"
                    >
                      Açık Niyetime Git →
                    </Link>
                  ) : option.can_reopen ? (
                    <button
                      type="button"
                      disabled={workingKey !== null}
                      onClick={() => reopenIntent(option)}
                      className="mt-3 rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
                    >
                      {workingKey === `reopen:${option.intent_id}` ? "Açılıyor..." : "Niyetimi Yeniden Aç"}
                    </button>
                  ) : option.recovery_reason === "intent_window_ended" ? (
                    <Link
                      href={`/onboarding?copyFrom=${encodeURIComponent(option.intent_id)}`}
                      className="mt-3 inline-flex rounded-lg bg-gray-950 px-3 py-2 text-xs font-bold text-white"
                    >
                      Benzer Niyet Oluştur
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "cancel" && (
        <div className="mt-3 rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-black text-red-900">{cancelLabel}</p>
          <select
            value={cancelReason}
            disabled={workingKey !== null}
            onChange={(event) => {
              setCancelReason(event.target.value as CancelReason);
              setError(null);
            }}
            className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 outline-none focus:border-red-400"
          >
            <option value="">Neden seç</option>
            {CANCEL_REASONS.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
          <textarea
            value={note}
            disabled={workingKey !== null}
            maxLength={1000}
            rows={3}
            onChange={(event) => setNote(event.target.value)}
            placeholder="İstersen katılımcılara kısa bir açıklama ekle..."
            className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-red-400"
          />
          <p className="mt-2 text-[11px] leading-5 text-gray-500">
            İptal geçmişten silinmez. Bağlı Niyetler otomatik açılmaz; her Niyet sahibi kendi kararını verir.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={workingKey !== null}
              onClick={cancelPlan}
              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {workingKey === "cancel" ? "İptal ediliyor..." : "İptali Onayla"}
            </button>
            <button
              type="button"
              disabled={workingKey !== null}
              onClick={closeEditor}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {mode === "leave" && (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-black text-amber-950">{leaveLabel}</p>
          <select
            value={leaveReason}
            disabled={workingKey !== null}
            onChange={(event) => {
              setLeaveReason(event.target.value as LeaveReason);
              setError(null);
            }}
            className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 outline-none focus:border-amber-400"
          >
            <option value="">Neden seç</option>
            {LEAVE_REASONS.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
          <textarea
            value={note}
            disabled={workingKey !== null}
            maxLength={1000}
            rows={3}
            onChange={(event) => setNote(event.target.value)}
            placeholder="İstersen Ana Yürüten / Birlikte Yürüten için kısa bir açıklama ekle..."
            className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-amber-400"
          />
          <p className="mt-2 text-[11px] leading-5 text-gray-500">
            Seçtiğin neden yalnızca sen ve organizatörler tarafından görülür. Diğer katılımcılar yalnızca ayrıldığını görür.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={workingKey !== null}
              onClick={leavePlan}
              className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {workingKey === "leave" ? "Ayrılıyorsun..." : "Ayrılmayı Onayla"}
            </button>
            <button
              type="button"
              disabled={workingKey !== null}
              onClick={closeEditor}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600"
            >
              Kal
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
