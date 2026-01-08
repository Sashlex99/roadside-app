# Simple GitHub API test to debug issue creation
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

Write-Host "Testing GitHub API connection..." -ForegroundColor Green

# Test 1: Check repository access
try {
    $repoResponse = Invoke-RestMethod -Uri $baseUrl -Method GET -Headers $headers
    Write-Host "[SUCCESS] Repository access confirmed: $($repoResponse.full_name)" -ForegroundColor Green
}
catch {
    Write-Host "[ERROR] Cannot access repository: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Create a simple test issue
Write-Host "`nCreating test issue..." -ForegroundColor Green

$testIssue = @{
    title = "Test Issue - Can be deleted"
    body = "This is a test issue to verify API connectivity. You can delete this."
    labels = @("bug")
} | ConvertTo-Json

try {
    $issueResponse = Invoke-RestMethod -Uri "$baseUrl/issues" -Method POST -Headers $headers -Body $testIssue -ContentType "application/json"
    Write-Host "[SUCCESS] Created test issue #$($issueResponse.number)" -ForegroundColor Green
    Write-Host "Issue URL: $($issueResponse.html_url)" -ForegroundColor Cyan
}
catch {
    Write-Host "[ERROR] Failed to create test issue:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorResponse = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorResponse)
        $errorDetails = $reader.ReadToEnd()
        Write-Host "Error details: $errorDetails" -ForegroundColor Red
    }
}

# Test 3: Check file content length
Write-Host "`nChecking issue template file sizes..." -ForegroundColor Green

$files = @(
    "github_issues/issue_01_race_condition.md",
    "github_issues/issue_02_double_payment.md", 
    "github_issues/issue_03_security_logging.md"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $length = $content.Length
        Write-Host "$file : $length characters" -ForegroundColor Yellow
        
        # GitHub has a limit of ~65K characters for issue body
        if ($length -gt 60000) {
            Write-Host "[WARNING] File too large for GitHub API (>60K chars)" -ForegroundColor Red
        }
    } else {
        Write-Host "[ERROR] File not found: $file" -ForegroundColor Red
    }
} 