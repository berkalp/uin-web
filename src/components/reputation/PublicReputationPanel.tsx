import {
  formatReputationDimension,
  getReputationLevelClasses,
  getReputationLevelLabel,
  type PublicReputationSummary,
  type ReputationContextSummary,
} from "@/utils/reputation";

type PublicReputationPanelProps = {
  summary: PublicReputationSummary;
};

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
        {label}
      </p>

      <p className="mt-2 text-lg font-bold text-gray-950">
        {value}
      </p>
    </div>
  );
}

function formatConfidenceLevel(value: string) {
  if (value === "high") return "Yüksek";
  if (value === "medium") return "Orta";
  if (value === "low") return "Düşük";
  return value;
}
function ContextCard({
  context,
}: {
  context: ReputationContextSummary;
}) {
  const title =
    context.activity_name ||
    context.category_name ||
    "UIN bağlamı";

  const dimensions =
    Object.entries(
      context.dimension_scores ?? {}
    )
      .filter(
        ([, score]) =>
          score.responses >= 2 &&
          score.score >= 70
      )
      .sort(
        (first, second) =>
          second[1].score -
          first[1].score
      )
      .slice(0, 3);

  return (
    <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
            {context.context_type ===
            "activity"
              ? "Aktivite itibarı"
              : "Kategori itibarı"}
          </p>

          <h3 className="mt-2 text-lg font-bold text-gray-950">
            {title}
          </h3>
        </div>

        <span
          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${getReputationLevelClasses(
            context.reputation_level
          )}`}
        >
          {getReputationLevelLabel(
            context.reputation_level
          )}
        </span>
      </div>

      <p className="mt-3 text-sm text-gray-500">
        {context.activity_count} tamamlanmış aktiviteye dayanır.
      </p>

      {dimensions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {dimensions.map(
            ([dimension, score]) => (
              <span
                key={dimension}
                className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800"
              >
                {formatReputationDimension(
                  dimension
                )}{" "}
                · {Math.round(score.score)}%
              </span>
            )
          )}
        </div>
      )}
    </article>
  );
}

export default function PublicReputationPanel({
  summary,
}: PublicReputationPanelProps) {
  if (summary.is_managed_minor) {
    return (
      <section className="mt-0 bg-transparent p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
          Katılım geçmişi
        </p>

        <h2 className="mt-2 text-xl font-bold text-gray-950">
          Veli yönetimli aktivite geçmişi
        </h2>

        <p className="mt-3 text-sm leading-7 text-gray-600">
          {summary.participation_count} veli yönetimli aktiviteye katıldı.
          Yönetilen çocuk profillerinde sayısal kullanıcı itibarı gösterilmez.
        </p>
      </section>
    );
  }

  const global =
    summary.global;

  if (!global) {
    return (
      <section className="mt-0 bg-transparent p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
          İtibar
        </p>

        <h2 className="mt-2 text-xl font-bold text-gray-950">
          Paylaşılan aktivitelere yeni
        </h2>

        <p className="mt-3 text-sm leading-7 text-gray-600">
          Henüz itibar özeti göstermek için yeterli tamamlanmış aktivite geçmişi yok.
        </p>
      </section>
    );
  }

  const activityContexts =
    summary.contexts
      .filter(
        (context) =>
          context.context_type ===
          "activity"
      )
      .slice(0, 6);

  const categoryContexts =
    summary.contexts
      .filter(
        (context) =>
          context.context_type ===
          "category"
      )
      .slice(0, 4);

  return (
    <section className="mt-0 bg-transparent p-5 md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
            İtibar
          </p>

          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Bağlama göre güvenilirlik
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
            İtibar, doğrulanmış ortak aktivite davranışlarından oluşur. Takipçi sayısını, popülerliği veya beceri seviyesini içermez.
          </p>
        </div>

        <span
          className={`w-fit rounded-full border px-4 py-2 text-sm font-bold ${getReputationLevelClasses(
            global.reputation_level
          )}`}
        >
          {getReputationLevelLabel(
            global.reputation_level
          )}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Birlikte tamamlanan"
          value={String(
            global.activity_count
          )}
        />

        <Metric
          label="Katılım güvenilirliği"
          value={
            global.attendance_observation_count >=
            3
              ? `${Math.round(
                  global.attendance_rate ??
                    0
                )}%`
              : "Yeterli veri yok"
          }
        />

        <Metric
          label="Tekrar katılır"
          value={
            global.feedback_count >= 3 &&
            global.would_join_again_count !== null
              ? `${global.would_join_again_count} / ${global.feedback_count}`
              : "Yeterli veri yok"
          }
        />

        <Metric
          label="Veri güveni"
          value={
            formatConfidenceLevel(global.confidence_level)
          }
        />
      </div>

      {activityContexts.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
            Aktiviteye göre
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activityContexts.map(
              (context) => (
                <ContextCard
                  key={`${context.context_key}-${context.role}`}
                  context={context}
                />
              )
            )}
          </div>
        </div>
      )}

      {categoryContexts.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
            Kategoriye göre
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {categoryContexts.map(
              (context) => (
                <ContextCard
                  key={`${context.context_key}-${context.role}`}
                  context={context}
                />
              )
            )}
          </div>
        </div>
      )}
    </section>
  );
}
