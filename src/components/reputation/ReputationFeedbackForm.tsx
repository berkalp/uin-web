"use client";

import {
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

import {
  supabase,
} from "@/utils/supabase/client";
import type {
  ReputationFeedbackFormData,
} from "@/utils/reputation";

type AnswerValue =
  | number
  | boolean;

type ReputationFeedbackFormProps = {
  form: ReputationFeedbackFormData;
  returnHref?: string;
};

function getInitial(
  value: string
) {
  return (
    value.trim().charAt(0).toUpperCase() ||
    "?"
  );
}

function getRoleLabel(
  role: string
) {
  if (role === "host") return "Ana Yürüten";
  if (role === "co_host") return "Birlikte Yürüten";
  if (role === "participant") return "Katılımcı";
  return role.replaceAll("_", " ");
}

function getScopeLabel(
  scope: string
) {
  if (scope === "general") return "Genel";
  if (scope === "activity") return "Aktivite";
  return scope.replaceAll("_", " ");
}

export default function ReputationFeedbackForm({
  form,
  returnHref,
}: ReputationFeedbackFormProps) {
  const router =
    useRouter();

  const [answers, setAnswers] =
    useState<Record<string, AnswerValue>>(
      {}
    );

  const [wouldJoinAgain, setWouldJoinAgain] =
    useState<boolean | null>(null);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const targetName =
    form.target.full_name ||
    form.target.username;

  const missingRequired =
    useMemo(
      () =>
        form.questions.some(
          (question) =>
            question.is_required &&
            answers[question.id] ===
              undefined
        ),
      [
        answers,
        form.questions,
      ]
    );

  async function submit() {
    if (
      wouldJoinAgain === null ||
      missingRequired
    ) {
      setError(
        "Zorunlu soruları ve yeniden birlikte katılma sorusunu yanıtla."
      );
      return;
    }

    setBusy(true);
    setError(null);

    const payload =
      form.questions
        .filter(
          (question) =>
            answers[question.id] !==
            undefined
        )
        .map(
          (question) => ({
            question_id:
              question.id,
            value:
              answers[question.id],
          })
        );

    const {
      error: submitError,
    } = await supabase.rpc(
      "submit_reputation_feedback",
      {
        p_plan_id:
          form.plan.id,
        p_target_user_id:
          form.target.id,
        p_would_join_again:
          wouldJoinAgain,
        p_answers:
          payload,
      }
    );

    setBusy(false);

    if (submitError) {
      setError(
        submitError.message
      );
      return;
    }

    router.push(
      returnHref ||
        "/reputation/feedback?submitted=1"
    );
    router.refresh();
  }

  if (form.existing_feedback_id) {
    return (
      <section className="rounded-3xl border border-green-200 bg-green-50 p-6">
        <h1 className="text-2xl font-bold text-green-950">
          Değerlendirme zaten gönderildi
        </h1>

        <p className="mt-3 text-sm leading-7 text-green-800">
          Yanıtların, gönderdiğin sırada aktif olan soru sürümüyle birlikte saklanıyor.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex items-center gap-4">
          {form.target.avatar_url ? (
            <img
              src={
                form.target.avatar_url
              }
              alt={targetName}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 text-xl font-bold text-purple-800">
              {getInitial(
                targetName
              )}
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
              {getRoleLabel(form.target.role)} değerlendirmesi
            </p>

            <h1 className="mt-1 text-2xl font-bold text-gray-950">
              {targetName}
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              {form.plan.title}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-7 text-blue-900">
          Yalnızca bu Aktivite bağlamını değerlendir. Beceri seviyesi itibar değildir: yeni başlayan biri saygılı, güvenli ve güvenilir olabilir; uzman biri kötü davranabilir.
        </div>
      </section>

      {form.questions.map(
        (question, index) => {
          const value =
            answers[question.id];

          return (
            <section
              key={question.id}
              className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-950 text-xs font-bold text-white">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-purple-700">
                      {getScopeLabel(question.scope_type)}
                    </span>

                    {question.is_required && (
                      <span className="text-xs font-semibold text-red-600">
                        Zorunlu
                      </span>
                    )}
                  </div>

                  <h2 className="mt-3 text-lg font-bold text-gray-950">
                    {question.prompt}
                  </h2>

                  {question.response_type ===
                  "yes_no" ? (
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      {[true, false].map(
                        (answer) => (
                          <button
                            key={String(
                              answer
                            )}
                            type="button"
                            onClick={() =>
                              setAnswers({
                                ...answers,
                                [question.id]:
                                  answer,
                              })
                            }
                            className={`rounded-2xl border px-4 py-4 text-sm font-bold transition ${
                              value === answer
                                ? answer
                                  ? "border-green-500 bg-green-600 text-white"
                                  : "border-gray-700 bg-gray-900 text-white"
                                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {answer
                              ? "Evet"
                              : "Hayır"}
                          </button>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="mt-5">
                      <div className="grid grid-cols-5 gap-2">
                        {[1, 2, 3, 4, 5].map(
                          (rating) => (
                            <button
                              key={rating}
                              type="button"
                              onClick={() =>
                                setAnswers({
                                  ...answers,
                                  [question.id]:
                                    rating,
                                })
                              }
                              className={`rounded-2xl border py-4 text-lg font-black transition ${
                                value === rating
                                  ? "border-purple-600 bg-purple-600 text-white"
                                  : "border-gray-200 bg-white text-gray-700 hover:border-purple-300 hover:bg-purple-50"
                              }`}
                            >
                              {rating}
                            </button>
                          )
                        )}
                      </div>

                      <div className="mt-2 flex justify-between gap-3 text-xs text-gray-500">
                        <span>
                          {question.options
                            ?.low_label ||
                            "Düşük"}
                        </span>
                        <span className="text-right">
                          {question.options
                            ?.high_label ||
                            "Yüksek"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        }
      )}

      <section className="rounded-3xl border border-green-200 bg-green-50 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
          Son değerlendirme
        </p>

        <h2 className="mt-2 text-xl font-bold text-green-950">
          Bu bağlamda {targetName} ile yeniden bir Aktiviteye katılır mıydın?
        </h2>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {[true, false].map(
            (answer) => (
              <button
                key={String(answer)}
                type="button"
                onClick={() =>
                  setWouldJoinAgain(
                    answer
                  )
                }
                className={`rounded-2xl border px-4 py-4 text-sm font-bold transition ${
                  wouldJoinAgain === answer
                    ? answer
                      ? "border-green-600 bg-green-600 text-white"
                      : "border-gray-800 bg-gray-900 text-white"
                    : "border-green-200 bg-white text-green-900 hover:bg-green-100"
                }`}
              >
                {answer
                  ? "Evet, katılırdım"
                  : "Hayır"}
              </button>
            )
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="max-w-2xl text-xs leading-6 text-gray-500">
          Ham yanıtlar yayımlanmaz. Toplu sonuçlar yalnızca yeterli veri olduğunda görünür. Karşılıklı değerlendirmeler birlikte açıklanır; aksi durumda değerlendirme süresi kapandıktan sonra görünür olabilir.
        </p>

        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="rounded-xl bg-purple-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-purple-800 disabled:opacity-50"
        >
          {busy
            ? "Gönderiliyor…"
            : "Değerlendirmeyi Gönder"}
        </button>
      </div>
    </div>
  );
}
