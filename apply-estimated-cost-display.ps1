$ErrorActionPreference = "Stop"

function Backup-File {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "File not found: $Path"
    }

    $backupPath = "$Path.estimated-cost.bak"

    if (-not (Test-Path -LiteralPath $backupPath)) {
        Copy-Item -LiteralPath $Path -Destination $backupPath
        Write-Host "Backup created: $backupPath"
    }
}

function Replace-Once {
    param(
        [Parameter(Mandatory = $true)][string]$Content,
        [Parameter(Mandatory = $true)][string]$Pattern,
        [Parameter(Mandatory = $true)][string]$Replacement,
        [Parameter(Mandatory = $true)][string]$Description
    )

    $regex = [regex]::new(
        $Pattern,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    $matches = $regex.Matches($Content)

    if ($matches.Count -eq 0) {
        throw "Could not find expected code for: $Description"
    }

    if ($matches.Count -gt 1) {
        throw "Found more than one matching block for: $Description"
    }

    return $regex.Replace(
        $Content,
        $Replacement,
        1
    )
}

$projectRoot = (Get-Location).Path

$estimatedCostUtility = Join-Path `
    $projectRoot `
    "src\utils\estimatedCost.ts"

if (-not (Test-Path -LiteralPath $estimatedCostUtility)) {
    throw @"
src\utils\estimatedCost.ts was not found.

Extract uin-estimated-cost-update.zip into the project root first,
then run this script again.
"@
}

# ============================================================
# Timeline Intent card
# ============================================================

$timelinePath = Join-Path `
    $projectRoot `
    "src\components\timeline\TimelineIntentPresentation.tsx"

Backup-File -Path $timelinePath

$timeline = Get-Content `
    -LiteralPath $timelinePath `
    -Raw

if (
    $timeline -notmatch `
        'formatEstimatedCost'
) {
    $timeline = Replace-Once `
        -Content $timeline `
        -Pattern '(import\s*\{\s*resolveActivityCover,\s*\}\s*from\s*"\.\./\.\./utils/activityCover";)' `
        -Replacement '$1

import {
  formatEstimatedCost,
} from "../../utils/estimatedCost";' `
        -Description "Timeline estimated-cost import"
}

$timeline = [regex]::Replace(
    $timeline,
    'function\s+formatBudget\s*\(\s*value:\s*number\s*\)\s*\{.*?\}\s*\r?\n\r?\n(?=export\s+default\s+function)',
    '',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
)

$timeline = Replace-Once `
    -Content $timeline `
    -Pattern '<p className="text-\[11px\] font-semibold uppercase tracking-wide text-gray-400">\s*Budget\s*</p>\s*<p className="mt-1 truncate font-bold text-gray-950">\s*\{budget === null\s*\?\s*"Not set"\s*:\s*`\$\{formatBudget\(\s*budget\s*\)\} TL`\}\s*</p>' `
    -Replacement '<p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Estimated cost / person
              </p>

              <p className="mt-1 truncate font-bold text-gray-950">
                {formatEstimatedCost(
                  budget,
                  {
                    includePerPerson:
                      false,
                  }
                )}
              </p>' `
    -Description "Timeline Budget display"

Set-Content `
    -LiteralPath $timelinePath `
    -Value $timeline `
    -Encoding utf8

Write-Host "Updated: $timelinePath"

# ============================================================
# Intent / Plan detail page
# ============================================================

$detailPath = Join-Path `
    $projectRoot `
    "src\app\activities\[resourceId]\page.tsx"

Backup-File -Path $detailPath

$detail = Get-Content `
    -LiteralPath $detailPath `
    -Raw

if (
    $detail -notmatch `
        'formatEstimatedCost'
) {
    $detail = Replace-Once `
        -Content $detail `
        -Pattern '(import\s*\{\s*getActivityVisibilityLabel,\s*type\s+ActivityVisibility,\s*\}\s*from\s*"@/utils/activityVisibility";)' `
        -Replacement '$1

import {
  formatEstimatedCost,
} from "@/utils/estimatedCost";' `
        -Description "Activity detail estimated-cost import"
}

$detail = Replace-Once `
    -Content $detail `
    -Pattern '<div className="rounded-2xl border border-gray-200 bg-white p-5">\s*<p className="text-xs font-semibold uppercase tracking-wide text-gray-400">\s*Budget\s*</p>\s*<p className="mt-3 text-sm font-bold text-gray-950">\s*\{activity\.budget !==\s*null\s*\?\s*`\$\{Number\(\s*activity\.budget\s*\)\.toLocaleString\(\s*"en-US"\s*\)\} TL`\s*:\s*"Not set"\}\s*</p>\s*</div>' `
    -Replacement '<div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {page.resource_type ===
                      "intent"
                        ? "Estimated cost / person"
                        : "Plan budget"}
                    </p>

                    <p className="mt-3 text-sm font-bold text-gray-950">
                      {page.resource_type ===
                      "intent"
                        ? formatEstimatedCost(
                            activity.budget,
                            {
                              includePerPerson:
                                false,
                            }
                          )
                        : activity.budget !==
                            null
                          ? `${Number(
                              activity.budget
                            ).toLocaleString(
                              "en-US"
                            )} TL`
                          : "Not set"}
                    </p>

                    {page.resource_type ===
                      "intent" && (
                      <p className="mt-2 text-xs leading-5 text-gray-500">
                        Each participant covers their own estimated cost. UIN does not collect payment.
                      </p>
                    )}
                  </div>' `
    -Description "Activity detail Budget display"

Set-Content `
    -LiteralPath $detailPath `
    -Value $detail `
    -Encoding utf8

Write-Host "Updated: $detailPath"
Write-Host ""
Write-Host "Estimated cost display updates completed."
Write-Host "Run: npm run dev"
