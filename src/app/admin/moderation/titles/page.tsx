import Link from "next/link";

import TitleModerationActions from "@/components/admin/TitleModerationActions";
import { requireAdmin } from "@/utils/admin";

type TitleReportStatus = "pending" | "dismissed" | "removed";

type TitleReportRow = {
  report_id: string;
  plan_id: string;
  plan_status: string;
  custom_title_snapshot: string;
  canonical_title_snapshot: string;
  reason: string;
  details: string | null;
  report_status: TitleReportStatus;
  reporter_user_id: string;
  reporter_full_name: string | null;
  reporter_username: string | null;
  reporter_avatar_url: string | null;
  host_user_id: string;
  host_full_name: string | null;
  host_username: string | null;
  host_avatar_url: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  total_count: number | string | null;
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function reasonLabel(reason: string) {
  return reason
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Identity({
  fullName,
  username,
  avatarUrl,
  label,
}: {
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  label: string;
}) {
  const name = fullName || username || "UIN member";
  const content = (
    <div className="flex items-center gap-3">
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="h-10 w-10 rounded-full object-cover" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-500">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">{label}</p>
        <p className="truncate text-sm font-bold text-gray-950">{name}</p>
        {username && <p className="truncate text-xs text-gray-500">@{username}</p>}
      </div>
    </div>
  );

  return username ? (
    <Link href={`/u/${encodeURIComponent(username)}`} className="rounded-xl hover:bg-gray-50">
      {content}
    </Link>
  ) : (
    content
  );
}

export default async function AdminTitleModerationPage({ searchParams }: PageProps) {
  const { supabase, role } = await requireAdmin();
  const params = await searchParams;

  const rawStatus = getSingle(params.status);
  const status: TitleReportStatus | "" =
    rawStatus === "pending" || rawStatus === "dismissed" || rawStatus === "removed"
      ? rawStatus
      : "pending";

  const rawPage = Number(getSingle(params.page));
  const currentPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = 24;
  const offset = (currentPage - 1) * pageSize;

  const { data, error } = await supabase.rpc("get_admin_plan_title_reports", {
    p_status: status || null,
    p_limit: pageSize,
    p_offset: offset,
  });

  const reports = (data ?? []) as TitleReportRow[];
  const total = reports.length ? Number(reports[0].total_count ?? 0) : 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canResolve = role === "owner" || role === "admin" || role === "moderator";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                Moderation · Custom titles
              </p>
              <h1 className="mt-3 text-3xl font-bold text-gray-950 md:text-4xl">
                Reported Activity titles
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-500">
                A report immediately hides the user-authored title and shows the
                canonical Activity name. Review restores the title or removes it;
                the Activity lifecycle and reputation are not changed here.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/admin/moderation" className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700">
                ← Moderation
              </Link>
              <Link href="/admin" className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white">
                Admin Dashboard
              </Link>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {(["pending", "dismissed", "removed"] as const).map((item) => (
              <Link
                key={item}
                href={`/admin/moderation/titles?status=${item}`}
                className={`rounded-full px-4 py-2 text-xs font-semibold capitalize ${
                  status === item ? "bg-gray-950 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {item}
              </Link>
            ))}
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-800">
            {error.message}
          </div>
        )}

        {!error && reports.length === 0 && (
          <div className="mt-6 rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
            No {status} custom-title reports.
          </div>
        )}

        {!error && reports.length > 0 && (
          <section className="mt-6 grid gap-5 lg:grid-cols-2">
            {reports.map((report) => (
              <article key={report.report_id} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                    report.report_status === "pending"
                      ? "bg-amber-50 text-amber-800"
                      : report.report_status === "removed"
                        ? "bg-red-50 text-red-700"
                        : "bg-green-50 text-green-700"
                  }`}>
                    {report.report_status}
                  </span>
                  <span className="text-xs text-gray-400">{formatDateTime(report.created_at)}</span>
                </div>

                <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-700">Reported custom title</p>
                  <p className="mt-2 text-lg font-black text-red-950">{report.custom_title_snapshot}</p>
                </div>

                <div className="mt-3 rounded-2xl border border-green-100 bg-green-50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-green-700">Original Activity</p>
                  <p className="mt-2 text-base font-bold text-green-950">{report.canonical_title_snapshot}</p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Identity
                    label="Reported by"
                    fullName={report.reporter_full_name}
                    username={report.reporter_username}
                    avatarUrl={report.reporter_avatar_url}
                  />
                  <Identity
                    label="Primary Host"
                    fullName={report.host_full_name}
                    username={report.host_username}
                    avatarUrl={report.host_avatar_url}
                  />
                </div>

                <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                  <p><span className="font-semibold">Reason:</span> {reasonLabel(report.reason)}</p>
                  {report.details && <p className="mt-2 leading-6">{report.details}</p>}
                  <p className="mt-2 text-xs text-gray-400">Plan status · {report.plan_status}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/plans/${encodeURIComponent(report.plan_id)}/activity?returnTo=${encodeURIComponent("/admin/moderation/titles")}&returnLabel=${encodeURIComponent("Title Moderation")}`}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700"
                  >
                    View Activity
                  </Link>
                </div>

                {report.report_status === "pending" && canResolve && (
                  <TitleModerationActions reportId={report.report_id} />
                )}

                {report.report_status !== "pending" && (
                  <div className="mt-5 border-t border-gray-100 pt-4 text-xs text-gray-500">
                    Resolved {formatDateTime(report.resolved_at)}
                    {report.resolution_note ? ` · ${report.resolution_note}` : ""}
                  </div>
                )}
              </article>
            ))}
          </section>
        )}

        {totalPages > 1 && (
          <nav className="mt-8 flex flex-wrap justify-center gap-2" aria-label="Title moderation pages">
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
              <Link
                key={page}
                href={`/admin/moderation/titles?status=${status}&page=${page}`}
                className={`min-w-10 rounded-xl px-3 py-2 text-center text-sm font-semibold ${
                  page === currentPage ? "bg-gray-950 text-white" : "border border-gray-200 bg-white text-gray-600"
                }`}
              >
                {page}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </main>
  );
}
