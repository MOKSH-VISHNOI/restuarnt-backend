$ErrorActionPreference = "Continue"
$root = (Get-Location).Path
$report = Join-Path $root "payment-diagnostics-report.txt"

"Yatharth Payment Diagnostics" | Set-Content $report
"Generated: $(Get-Date)" | Add-Content $report
"Project: $root" | Add-Content $report
"READ-ONLY: No database writes or payment requests." | Add-Content $report

$files = @(
    "src\config\prisma.js",
    "src\lib\prisma.js",
    "src\controllers\paymentController.js",
    "src\jobs\paymentExpiryJob.js",
    "test\payment-controller.test.js"
)

foreach ($file in $files) {
    $path = Join-Path $root $file
    "`r`n$('=' * 70)`r`nFILE: $file`r`n$('=' * 70)" |
        Add-Content $report

    if (Test-Path -LiteralPath $path) {
        $content = Get-Content -LiteralPath $path

        if ($file -match "paymentController\.js$") {
            $patterns = @(
                "recordFailedPayment",
                "confirmCapturedPayment",
                "verifyGatewayPayment",
                "reconcilePendingPayment",
                "getPaymentAttemptsForOrder",
                "getCapturedPaymentIdsForOrder",
                "P2028",
                "Transaction already closed"
            )

            for ($i = 0; $i -lt $content.Count; $i++) {
                foreach ($pattern in $patterns) {
                    if ($content[$i] -match $pattern) {
                        $start = [Math]::Max(0, $i - 3)
                        $end = [Math]::Min($content.Count - 1, $i + 12)

                        "Lines $($start + 1)-$($end + 1)" |
                            Add-Content $report
                        $content[$start..$end] |
                            Add-Content $report
                        "" | Add-Content $report
                        break
                    }
                }
            }
        }
        else {
            $content | Add-Content $report
        }
    }
    else {
        "File not found." | Add-Content $report
    }
}

"`r`n$('=' * 70)`r`nTRANSACTION SETTINGS SEARCH" |
    Add-Content $report

Get-ChildItem (Join-Path $root "src"), (Join-Path $root "prisma") `
    -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Extension -in @(".js", ".ts", ".prisma")
    } |
    Select-String -Pattern `
        'P2028|Transaction already closed|timeout\s*:|maxWait\s*:' |
    ForEach-Object {
        "$($_.Path):$($_.LineNumber): $($_.Line.Trim())"
    } |
    Add-Content $report

Write-Host "`nDiagnostics complete." -ForegroundColor Green
Write-Host "Report: $report" -ForegroundColor Cyan
Write-Host "No application code or database records were changed."
