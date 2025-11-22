<#!
.SYNOPSIS
  Backfill MB Way ticket confirmations into mythoria.payment_orders and payment_events.

.DESCRIPTION
  Fetches historical MB Way payment tickets from the backoffice database, filters out
  test accounts (emails containing "jacome", "andreaperavieira" or a plus sign),
  skips tickets that already produced a payment order, and inserts missing rows into
  the mythoria database so revenue analytics can surface prior MB Way sales.

.NOTES
  - Requires the `psql` CLI in PATH.
  - Relies on the standard admin env vars: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD,
    BACKOFFICE_DB, MYTHORIA_DB.
  - Run with `pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/backfill-mbway-orders.ps1`.
  - Use `-WhatIf` to preview actions without modifying the database.
#>
[CmdletBinding()]
param(
  [switch]$WhatIf
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$requiredEnv = @('DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'BACKOFFICE_DB', 'MYTHORIA_DB')
$missing = @()
foreach ($name in $requiredEnv) {
  $value = (Get-Item -Path "Env:$name" -ErrorAction SilentlyContinue)?.Value
  if ([string]::IsNullOrWhiteSpace($value)) {
    $missing += $name
  }
}
if ($missing.Count -gt 0) {
  throw "Missing required environment variables: $($missing -join ', ')"
}

if (-not (Get-Command -Name psql -ErrorAction SilentlyContinue)) {
  throw 'psql CLI is required but was not found in PATH.'
}

$culture = [System.Globalization.CultureInfo]::InvariantCulture

function Invoke-PostgresQuery {
  param(
    [Parameter(Mandatory)] [string]$Database,
    [Parameter(Mandatory)] [string]$Sql,
    [switch]$AsJson
  )

  $env:PGPASSWORD = $env:DB_PASSWORD
  $arguments = @(
    '-h', $env:DB_HOST,
    '-p', $env:DB_PORT,
    '-U', $env:DB_USER,
    '-d', $Database,
    '-v', 'ON_ERROR_STOP=1',
    '-q',
    '-A',
    '-t',
    '-c', $Sql
  )

  $output = & psql @arguments
  $exitCode = $LASTEXITCODE
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

  if ($exitCode -ne 0) {
    throw "psql exited with code $exitCode when running query against $Database"
  }

  $text = ($output | Where-Object { $_ -ne '' }) -join ""
  if ($AsJson) {
    return $text.Trim()
  }

  return $text
}

function ConvertTo-JsonLiteral {
  param([Parameter(Mandatory)] $Value)
  $json = ($Value | ConvertTo-Json -Depth 10 -Compress)
  $escaped = $json -replace "'", "''"
  return "('$escaped')::jsonb"
}

$ticketQuery = @"
WITH candidate AS (
  SELECT
    id::text AS ticket_id,
    user_id::text AS user_id,
    metadata,
    status,
    created_at AT TIME ZONE 'UTC' AS created_at,
    updated_at AT TIME ZONE 'UTC' AS updated_at
  FROM tickets
  WHERE category = 'payment_request'
    AND lower(metadata ->> 'paymentMethod') = 'mbway'
    AND status IN ('resolved','closed')
    AND COALESCE(metadata #>> '{mbwayPayment,status}', 'pending') = 'confirmed'
    AND (metadata ->> 'amount') IS NOT NULL
    AND (metadata ->> 'credits') IS NOT NULL
)
SELECT COALESCE(json_agg(candidate), '[]'::json)
FROM candidate;
"@

$ticketJson = Invoke-PostgresQuery -Database $env:BACKOFFICE_DB -Sql $ticketQuery -AsJson
$tickets = if ([string]::IsNullOrWhiteSpace($ticketJson)) { @() } else { $ticketJson | ConvertFrom-Json }

if (-not $tickets -or $tickets.Count -eq 0) {
  Write-Host 'No historical MB Way tickets found.'
  return
}

$summary = [System.Collections.Generic.List[object]]::new()
$inserted = 0
$skipped = 0

foreach ($ticket in $tickets) {
  try {
    $metadata = $ticket.metadata
    if ($metadata -is [string]) {
      $metadata = $metadata | ConvertFrom-Json
    }

    $authorId = $null
    if ($metadata.author -and $metadata.author.id) {
      $authorId = [string]$metadata.author.id
    }
    elseif ($ticket.user_id) {
      $authorId = [string]$ticket.user_id
    }

    if (-not $authorId) {
      $skipped++
      $summary.Add([pscustomobject]@{ TicketId = $ticket.ticket_id; Result = 'Skipped'; Reason = 'Missing authorId' })
      continue
    }

    $authorSql = "SELECT COALESCE(row_to_json(payload), '{}'::json) FROM (SELECT author_id::text AS author_id, email, display_name, COALESCE(mobile_phone,'') AS mobile_phone FROM authors WHERE author_id = '$authorId' LIMIT 1) payload;"
    $authorJson = Invoke-PostgresQuery -Database $env:MYTHORIA_DB -Sql $authorSql -AsJson
    if ([string]::IsNullOrWhiteSpace($authorJson)) {
      $skipped++
      $summary.Add([pscustomobject]@{ TicketId = $ticket.ticket_id; Result = 'Skipped'; Reason = 'Author not found' })
      continue
    }

    $author = $authorJson | ConvertFrom-Json
    if (-not $author.email) {
      $skipped++
      $summary.Add([pscustomobject]@{ TicketId = $ticket.ticket_id; Result = 'Skipped'; Reason = 'Author email missing' })
      continue
    }

    $emailLower = $author.email.ToLowerInvariant()
    if ($emailLower -like '*jacome*' -or $emailLower -like '*andreaperavieira*' -or $author.email -like '*+*@*') {
      $skipped++
      $summary.Add([pscustomobject]@{ TicketId = $ticket.ticket_id; Result = 'Skipped'; Reason = 'Test account filtered' })
      continue
    }

    $amountRaw = $metadata.amount
    $creditsRaw = $metadata.credits
    if (-not $amountRaw -or -not $creditsRaw) {
      $skipped++
      $summary.Add([pscustomobject]@{ TicketId = $ticket.ticket_id; Result = 'Skipped'; Reason = 'Missing amount or credits' })
      continue
    }

    $amountDecimal = [decimal]::Parse($amountRaw.ToString(), $culture)
    $credits = [int]$creditsRaw
    if ($amountDecimal -le 0 -or $credits -le 0) {
      $skipped++
      $summary.Add([pscustomobject]@{ TicketId = $ticket.ticket_id; Result = 'Skipped'; Reason = 'Invalid amount or credits' })
      continue
    }

    $providerOrderId = "MBWAY-$($ticket.ticket_id)"
    $existingSql = "SELECT order_id::text FROM payment_orders WHERE provider_order_id = '$providerOrderId' LIMIT 1;"
    $existingOrder = Invoke-PostgresQuery -Database $env:MYTHORIA_DB -Sql $existingSql
    if (-not [string]::IsNullOrWhiteSpace($existingOrder)) {
      $skipped++
      $summary.Add([pscustomobject]@{ TicketId = $ticket.ticket_id; Result = 'Skipped'; Reason = 'Payment order already exists' })
      continue
    }

    $requestedAt = if ($metadata.mbwayPayment.requestedAt) {
      [DateTimeOffset]::Parse($metadata.mbwayPayment.requestedAt.ToString(), $culture)
    }
    else {
      [DateTimeOffset]::Parse($ticket.created_at.ToString(), $culture)
    }

    $resolvedAt = if ($metadata.mbwayPayment.updatedAt) {
      [DateTimeOffset]::Parse($metadata.mbwayPayment.updatedAt.ToString(), $culture)
    }
    else {
      [DateTimeOffset]::Parse($ticket.updated_at.ToString(), $culture)
    }

    $orderId = [guid]::NewGuid().ToString()
    $amountCents = [int][Math]::Round($amountDecimal * 100)

    $packages = $metadata.creditPackages
    if (-not $packages) {
      $packages = @()
    }

    $creditBundle = @{ credits = $credits; price = [double]$amountDecimal; packages = $packages }
    $orderMetadata = @{
      ticketId      = $ticket.ticket_id
      paymentMethod = 'mbway'
      importSource  = '2025-11-mbway-ticket-backfill'
      confirmedBy   = $metadata.mbwayPayment.updatedBy
      requestedAt   = $requestedAt.ToString('o')
      resolvedAt    = $resolvedAt.ToString('o')
    }

    $creditBundleLiteral = ConvertTo-JsonLiteral -Value $creditBundle
    $orderMetadataLiteral = ConvertTo-JsonLiteral -Value $orderMetadata

    $orderSql = @"
INSERT INTO payment_orders (
  order_id,
  author_id,
  amount,
  currency,
  status,
  provider,
  provider_order_id,
  credit_bundle,
  metadata,
  created_at,
  updated_at
) VALUES (
  '$orderId'::uuid,
  '$authorId'::uuid,
  $amountCents,
  'eur',
  'completed',
  'other',
  '$providerOrderId',
  $creditBundleLiteral,
  $orderMetadataLiteral,
  '$($resolvedAt.ToString('o'))',
  '$($resolvedAt.ToString('o'))'
);
"@

    $eventPayloadCreated = @{
      ticketId    = $ticket.ticket_id
      origin      = 'mbway-ticket-backfill'
      requestedAt = $requestedAt.ToString('o')
    }
    $eventPayloadCompleted = @{
      ticketId    = $ticket.ticket_id
      origin      = 'mbway-ticket-backfill'
      resolvedAt  = $resolvedAt.ToString('o')
      confirmedBy = $metadata.mbwayPayment.updatedBy
    }
    $eventSql = @"
INSERT INTO payment_events (event_id, order_id, event_type, data, created_at) VALUES
  ('$([guid]::NewGuid())'::uuid, '$orderId'::uuid, 'order_created',  $(ConvertTo-JsonLiteral -Value $eventPayloadCreated), '$($requestedAt.ToString('o'))'),
  ('$([guid]::NewGuid())'::uuid, '$orderId'::uuid, 'payment_completed', $(ConvertTo-JsonLiteral -Value $eventPayloadCompleted), '$($resolvedAt.ToString('o'))');
"@

    if ($WhatIf) {
      Write-Host "[WhatIf] Would insert order $orderId for ticket $($ticket.ticket_id)"
    }
    else {
      $combinedSql = "$orderSql`n$eventSql"
      Invoke-PostgresQuery -Database $env:MYTHORIA_DB -Sql $combinedSql
    }

    $inserted++
    $summary.Add([pscustomobject]@{ TicketId = $ticket.ticket_id; Result = 'Inserted'; OrderId = $orderId; Amount = $amountDecimal; Credits = $credits })
  }
  catch {
    $skipped++
    $summary.Add([pscustomobject]@{ TicketId = $ticket.ticket_id; Result = 'Error'; Reason = $_.Exception.Message })
  }
}

Write-Host "Processed $($tickets.Count) tickets. Inserted: $inserted. Skipped/Error: $skipped."
$summary | Format-Table -AutoSize
