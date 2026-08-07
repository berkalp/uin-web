$ErrorActionPreference = "Stop"

$pagePath = Join-Path (Get-Location) "src\app\timeline\page.tsx"

if (-not (Test-Path -LiteralPath $pagePath)) {
    throw "Timeline page not found: $pagePath"
}

$backupPath = "$pagePath.compact-timeline.bak"

if (-not (Test-Path -LiteralPath $backupPath)) {
    Copy-Item -LiteralPath $pagePath -Destination $backupPath
    Write-Host "Backup created: $backupPath"
}

$content = Get-Content -LiteralPath $pagePath -Raw

if ($content -notmatch 'ActivityShareMenu') {
    $importAnchor = 'import TimelineExpiredPresentation from "../../components/timeline/TimelineExpiredPresentation";'

    if (-not $content.Contains($importAnchor)) {
        throw "Could not find TimelineExpiredPresentation import."
    }

    $content = $content.Replace(
        $importAnchor,
        $importAnchor + "`r`n" +
        'import ActivityShareMenu from "../../components/share/ActivityShareMenu";'
    )
}

if ($content -notmatch 'function getTimelineShareUrl') {
    $helperAnchor = 'function getTodayDateKey() {'

    $helper = @'
function getTimelineShareUrl(
  resourceId: string
) {
  const configuredUrl =
    process.env
      .NEXT_PUBLIC_SITE_URL
      ?.trim();

  const baseUrl =
    configuredUrl
      ? configuredUrl.replace(
          /\/$/,
          ""
        )
      : "http://localhost:3000";

  return `${baseUrl}/activities/${encodeURIComponent(
    resourceId
  )}`;
}

'@

    if (-not $content.Contains($helperAnchor)) {
        throw "Could not find getTodayDateKey helper."
    }

    $content = $content.Replace(
        $helperAnchor,
        $helper + $helperAnchor
    )
}

$content = $content.Replace(
    'className="overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-sm"',
    'className="min-w-0 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm"'
)

$content = $content.Replace(
    '<div className="space-y-6">',
    '<div className="grid grid-cols-1 gap-5 lg:grid-cols-2">'
)

$content = $content.Replace(
    '<div className="mx-auto max-w-5xl">',
    '<div className="mx-auto max-w-[1480px]">'
)

$intentFooterPattern = [regex]::new(
    '<div className="border-t border-gray-100 p-5">.*?</div>\s*</article>\s*\);\s*\}\s*\r?\n\s*const \{\s*\r?\n\s*plan,',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
)

$intentFooterMatches =
    $intentFooterPattern.Matches(
        $content
    )

if ($intentFooterMatches.Count -ne 1) {
    throw "Could not identify the Intent footer exactly once. Found: $($intentFooterMatches.Count)"
}

$intentFooterReplacement = @'
<div className="border-t border-gray-100 bg-white p-4">
            {intent.notes && (
              <p className="mb-3 line-clamp-2 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-600">
                {intent.notes}
              </p>
            )}

            <div className="flex items-stretch gap-2">
              <Link
                href={`/activities/${encodeURIComponent(
                  intent.id
                )}`}
                className="flex min-h-10 flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700"
              >
                View
              </Link>

              <div className="shrink-0">
                <ActivityShareMenu
                  title={`${activity?.name ?? "UIN Intent"} Intent`}
                  text={`I have a ${activity?.name ?? "UIN"} Intent. Are you in?`}
                  url={getTimelineShareUrl(
                    intent.id
                  )}
                  isPublic={
                    intent.visibility ===
                    "public"
                  }
                />
              </div>

              <details className="group relative flex-1">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-xl bg-gray-950 px-3 text-xs font-semibold text-white transition hover:bg-gray-800">
                  Manage
                  <span className="text-[10px] transition group-open:rotate-180">
                    ▼
                  </span>
                </summary>

                <div className="absolute bottom-full right-0 z-40 mb-2 w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
                  <div className="grid gap-3">
                    {requestCount >
                      0 &&
                      intent.status ===
                        "active" && (
                        <Link
                          href="/requests"
                          className="rounded-xl bg-green-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-green-700"
                        >
                          Review{" "}
                          {requestCount} request
                          {requestCount ===
                          1
                            ? ""
                            : "s"}
                        </Link>
                      )}

                    {intent.status ===
                      "active" &&
                      intent.recruitment_status ===
                        "open" &&
                      intent.end_date >=
                        today && (
                        <IntentInvitePeopleButton
                          intentId={
                            intent.id
                          }
                          activityLabel={
                            activity?.name ??
                            "UIN Activity"
                          }
                          compact
                        />
                      )}

                    <Link
                      href={`/intents/${encodeURIComponent(
                        intent.id
                      )}/visibility`}
                      className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-center text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                    >
                      Manage Visibility
                    </Link>

                    <IntentActionButtons
                      intentId={
                        intent.id
                      }
                      status={
                        intent.status
                      }
                      recruitmentStatus={
                        intent.recruitment_status
                      }
                    />
                  </div>
                </div>
              </details>
            </div>
          </div>
        </article>
      );
    }

    const {
      plan,
'@

$content = $intentFooterPattern.Replace(
    $content,
    $intentFooterReplacement,
    1
)

$planActionAnchor = @'
        />

        {completionRequired && (
'@

if (-not $content.Contains($planActionAnchor)) {
    throw "Could not find the Plan presentation closing anchor."
}

$planActionReplacement = @'
        />

        <div className="flex items-stretch gap-2 border-t border-gray-100 bg-white p-4">
          <Link
            href={`/activities/${encodeURIComponent(
              plan.id
            )}`}
            className="flex min-h-10 flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700"
          >
            View
          </Link>

          <div className="shrink-0">
            <ActivityShareMenu
              title={`${plan.title || activity?.name || "UIN Activity"}`}
              text={`See this Activity on UIN.`}
              url={getTimelineShareUrl(
                plan.id
              )}
              isPublic={
                plan.visibility ===
                "public"
              }
            />
          </div>
        </div>

        {completionRequired && (
'@

$content = $content.Replace(
    $planActionAnchor,
    $planActionReplacement
)

Set-Content `
    -LiteralPath $pagePath `
    -Value $content `
    -Encoding utf8

Write-Host "Timeline page updated: $pagePath"
Write-Host "Compact Timeline components must already be copied into src\components\timeline."
Write-Host "Run: npm run dev"
