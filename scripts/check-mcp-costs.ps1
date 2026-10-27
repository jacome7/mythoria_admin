# Read-only Cloud Run cost and MCP transport checks over complete UTC days.
[CmdletBinding()]
param(
    [ValidateRange(1, 31)]
    [int]$Days = 7,
    [string]$ProjectId = "oceanic-beach-460916-n5",
    [string]$Region = "europe-west9",
    [string]$ServiceName = "mythoria-admin"
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false
$gcloudCommand = Get-Command gcloud -ErrorAction Stop
$gcloudPath = $gcloudCommand.Source
$endUtc = [DateTime]::UtcNow.Date
$startUtc = $endUtc.AddDays(-$Days)
$startTime = $startUtc.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'")
$endTime = $endUtc.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'")
$filter = 'resource.type="cloud_run_revision" AND resource.labels.service_name="' + $ServiceName + '" AND resource.labels.location="' + $Region + '" AND log_id("run.googleapis.com/requests") AND timestamp>="' + $startTime + '" AND timestamp<"' + $endTime + '"'
$rawLogs = & $gcloudPath logging read $filter --project=$ProjectId --limit=20000 --format=json
if ($LASTEXITCODE -ne 0) { throw "Unable to read Cloud Run request logs." }
$logs = @($rawLogs | ConvertFrom-Json)
if ($logs.Count -ge 20000) { throw "Request log limit reached. Retry with fewer days; totals are incomplete." }
$mcpGets = @($logs | Where-Object {
    $_.httpRequest.requestMethod -eq 'GET' -and ([uri]$_.httpRequest.requestUrl).AbsolutePath -eq '/api/mcp'
})
$streamingGets = @($mcpGets | Where-Object { $_.httpRequest.status -eq 200 })
$legacyMessages = @($logs | Where-Object {
    ([uri]$_.httpRequest.requestUrl).AbsolutePath -eq '/api/mcp/messages'
})

$accessToken = (& $gcloudPath auth print-access-token).Trim()
if ($LASTEXITCODE -ne 0 -or -not $accessToken) { throw "Unable to authenticate Cloud Monitoring read." }
try {
    $query = @{
        filter = 'metric.type="run.googleapis.com/container/billable_instance_time" AND resource.type="cloud_run_revision" AND resource.labels.service_name="' + $ServiceName + '" AND resource.labels.location="' + $Region + '"'
        'interval.startTime' = $startTime
        'interval.endTime' = $endTime
        'aggregation.alignmentPeriod' = '86400s'
        'aggregation.perSeriesAligner' = 'ALIGN_SUM'
        pageSize = '10000'
    }
    $queryString = ($query.GetEnumerator() | ForEach-Object {
        [uri]::EscapeDataString($_.Key) + '=' + [uri]::EscapeDataString($_.Value)
    }) -join '&'
    $metrics = Invoke-RestMethod -Uri "https://monitoring.googleapis.com/v3/projects/$ProjectId/timeSeries?$queryString" -Headers @{ Authorization = "Bearer $accessToken" }
} finally {
    $accessToken = $null
}
if ($metrics.nextPageToken) { throw "Monitoring result is incomplete. Retry with fewer days." }
if (-not $metrics.timeSeries) { throw "No billable time metrics were returned; usage is unknown." }
$points = @($metrics.timeSeries | ForEach-Object { $_.points })
if (-not $points.Count) { throw "No billable time samples were returned; usage is unknown." }
$seconds = ($points | ForEach-Object { [double]$_.value.doubleValue } | Measure-Object -Sum).Sum

[PSCustomObject]@{
    Project = $ProjectId
    Service = $ServiceName
    Region = $Region
    StartUtcInclusive = $startTime
    EndUtcExclusive = $endTime
    Requests = $logs.Count
    McpGetRequests = $mcpGets.Count
    McpStreamingGetResponses = $streamingGets.Count
    LegacyMessageRequests = $legacyMessages.Count
    BillableInstanceHours = [Math]::Round($seconds / 3600, 3)
    BillableInstanceHoursPerDay = [Math]::Round($seconds / 3600 / $Days, 3)
    StreamingGetTargetMet = ($streamingGets.Count -eq 0)
    BillableHoursTargetMet = ($seconds / 3600 / $Days -lt 1)
} | ConvertTo-Json
