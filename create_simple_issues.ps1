# Simple GitHub Issues Creation - Basic Version
param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubToken
)

$Owner = "sashlex99"
$Repo = "roadside-assistance"
$baseUrl = "https://api.github.com/repos/$Owner/$Repo"

$headers = @{
    "Authorization" = "Bearer $GitHubToken"
    "Accept" = "application/vnd.github.v3+json"
    "User-Agent" = "PowerShell-Script"
}

Write-Host "Creating 3 GitHub Issues with basic content..." -ForegroundColor Green

# Define basic issues
$issues = @(
    @{
        title = "CRITICAL: Race Condition in acceptBid() Function"
        body = @"
## Problem
Race condition in the acceptBid() function allows multiple clients to accept different bids simultaneously.

## Impact
- P0 Critical: Can cause double-booking of drivers
- Data corruption in Firestore
- Poor user experience

## Location
File: `src/services/firestore.ts`
Function: `acceptBid()`

## Solution
Implement Firestore runTransaction() for atomic operations.

## Implementation Guide
See the full implementation details at: https://github.com/sashlex99/roadside-assistance/blob/main/github_issues/issue_01_race_condition.md
"@
        labels = @("P0", "critical", "race-condition", "bug")
        milestone = 1
    },
    @{
        title = "CRITICAL: Double Payment Vulnerability in Payment Modal"
        body = @"
## Problem
Payment modal can be submitted multiple times during network delays, causing double charges.

## Impact
- P0 Critical: Financial impact on customers
- Trust issues and chargebacks
- Legal compliance problems

## Location
File: `src/hooks/client/useClientPayments.ts`
File: `src/components/client/modals/PaymentModal/index.tsx`

## Solution
Implement payment idempotency keys and button state management.

## Implementation Guide
See the full implementation details at: https://github.com/sashlex99/roadside-assistance/blob/main/github_issues/issue_02_double_payment.md
"@
        labels = @("P0", "critical", "payment", "security", "bug")
        milestone = 1
    },
    @{
        title = "HIGH: Security Exposure in Console Logs and Hardcoded Keys"
        body = @"
## Problem
Sensitive data exposed in console logs and hardcoded API keys in production builds.

## Impact
- P1 High: Security vulnerability
- API key exposure
- User data leakage

## Locations
- Multiple console.log statements with sensitive data
- Hardcoded keys in configuration files
- Production builds include debug information

## Solution
Implement secure logging and environment-based configuration.

## Implementation Guide
See the full implementation details at: https://github.com/sashlex99/roadside-assistance/blob/main/github_issues/issue_03_security_logging.md
"@
        labels = @("P1", "security", "bug")
        milestone = 1
    }
)

# Create issues
$issueCount = 0
foreach ($issue in $issues) {
    $issueCount++
    try {
        $issueBody = @{
            title = $issue.title
            body = $issue.body
            labels = $issue.labels
            milestone = $issue.milestone
        } | ConvertTo-Json -Depth 3
        
        $response = Invoke-RestMethod -Uri "$baseUrl/issues" -Method POST -Headers $headers -Body $issueBody -ContentType "application/json"
        Write-Host "[SUCCESS] Created issue #$($response.number): $($issue.title)" -ForegroundColor Green
        Write-Host "          URL: $($response.html_url)" -ForegroundColor Cyan
    }
    catch {
        Write-Host "[ERROR] Failed to create issue $issueCount" -ForegroundColor Red
        Write-Host "        Title: $($issue.title)" -ForegroundColor Red
        Write-Host "        Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nDone! Visit your issues at: https://github.com/$Owner/$Repo/issues" -ForegroundColor Green 