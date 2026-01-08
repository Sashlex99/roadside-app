# GitHub Issues Creation Script (Fixed Version)
param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubToken,
    
    [Parameter(Mandatory=$false)]
    [string]$Owner = "sashlex99",
    
    [Parameter(Mandatory=$false)]
    [string]$Repo = "roadside-assistance"
)

$baseUrl = "https://api.github.com/repos/$Owner/$Repo"
$headers = @{
    "Authorization" = "Bearer $GitHubToken"
    "Accept" = "application/vnd.github.v3+json"
    "User-Agent" = "PowerShell-Script"
}

Write-Host "Creating GitHub Labels..." -ForegroundColor Green

# Create Priority Labels
$priorityLabels = @(
    @{ name = "P0"; color = "d73a49"; description = "Critical - Must fix immediately" },
    @{ name = "P1"; color = "fb8500"; description = "High - Fix in current sprint" },
    @{ name = "P2"; color = "ffb700"; description = "Medium - Fix in next sprint" },
    @{ name = "P3"; color = "28a745"; description = "Low - Fix when convenient" }
)

# Create Component Labels  
$componentLabels = @(
    @{ name = "security"; color = "d73a49"; description = "Security related issue" },
    @{ name = "performance"; color = "1f77b4"; description = "Performance optimization" },
    @{ name = "bug"; color = "d73a49"; description = "Something isn't working" },
    @{ name = "critical"; color = "b60205"; description = "Critical system issue" },
    @{ name = "payment"; color = "ff6b6b"; description = "Payment system related" },
    @{ name = "race-condition"; color = "ff69b4"; description = "Concurrency issue" },
    @{ name = "memory-leak"; color = "9932cc"; description = "Memory management issue" }
)

$allLabels = $priorityLabels + $componentLabels

foreach ($label in $allLabels) {
    try {
        $labelBody = @{
            name = $label.name
            color = $label.color
            description = $label.description
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$baseUrl/labels" -Method POST -Headers $headers -Body $labelBody -ContentType "application/json"
        Write-Host "[SUCCESS] Created label: $($label.name)" -ForegroundColor Green
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 422) {
            Write-Host "[WARNING] Label '$($label.name)' already exists" -ForegroundColor Yellow
        } else {
            Write-Host "[ERROR] Failed to create label '$($label.name)': $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host "`nCreating GitHub Milestones..." -ForegroundColor Green

# Get existing milestones first
$existingMilestones = @{}
try {
    $milestones = Invoke-RestMethod -Uri "$baseUrl/milestones" -Method GET -Headers $headers
    foreach ($milestone in $milestones) {
        $existingMilestones[$milestone.title] = $milestone.number
    }
}
catch {
    Write-Host "[WARNING] Could not fetch existing milestones" -ForegroundColor Yellow
}

# Create new milestones
$milestonesToCreate = @(
    @{ 
        title = "Phase 1 - Critical Security & Race Conditions"
        description = "Address P0-P1 critical issues: race conditions, double payments, security vulnerabilities"
        due_on = (Get-Date).AddDays(14).ToString("yyyy-MM-ddTHH:mm:ssZ")
    },
    @{ 
        title = "Phase 2 - Performance & Memory Optimization"
        description = "Address P2 performance issues: memory leaks, battery optimization, retry logic"
        due_on = (Get-Date).AddDays(30).ToString("yyyy-MM-ddTHH:mm:ssZ")
    },
    @{ 
        title = "Phase 3 - Code Quality & Error Handling"
        description = "Address P3 optimization issues: React memoization, error handling improvements"
        due_on = (Get-Date).AddDays(45).ToString("yyyy-MM-ddTHH:mm:ssZ")
    },
    @{ 
        title = "Phase 4 - Documentation & Monitoring"
        description = "Complete documentation updates, monitoring setup, and final optimizations"
        due_on = (Get-Date).AddDays(60).ToString("yyyy-MM-ddTHH:mm:ssZ")
    }
)

foreach ($milestone in $milestonesToCreate) {
    if ($existingMilestones.ContainsKey($milestone.title)) {
        Write-Host "[WARNING] Milestone '$($milestone.title)' already exists (ID: $($existingMilestones[$milestone.title]))" -ForegroundColor Yellow
    } else {
        try {
            $milestoneBody = $milestone | ConvertTo-Json
            $response = Invoke-RestMethod -Uri "$baseUrl/milestones" -Method POST -Headers $headers -Body $milestoneBody -ContentType "application/json"
            $existingMilestones[$milestone.title] = $response.number
            Write-Host "[SUCCESS] Created milestone: $($milestone.title) (ID: $($response.number))" -ForegroundColor Green
        }
        catch {
            Write-Host "[ERROR] Failed to create milestone '$($milestone.title)': $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host "`nCreating GitHub Issues..." -ForegroundColor Green

# Read issue templates
$issue1Path = "github_issues/issue_01_race_condition.md"
$issue2Path = "github_issues/issue_02_double_payment.md"  
$issue3Path = "github_issues/issue_03_security_logging.md"

if (-not (Test-Path $issue1Path) -or -not (Test-Path $issue2Path) -or -not (Test-Path $issue3Path)) {
    Write-Host "[ERROR] Issue template files not found in github_issues/ directory" -ForegroundColor Red
    exit 1
}

$issue1Content = Get-Content $issue1Path -Raw -Encoding UTF8
$issue2Content = Get-Content $issue2Path -Raw -Encoding UTF8
$issue3Content = Get-Content $issue3Path -Raw -Encoding UTF8

# Define issues with proper milestone assignment
$phase1MilestoneId = $existingMilestones["Phase 1 - Critical Security & Race Conditions"]

$issues = @(
    @{
        title = "CRITICAL: Race Condition in acceptBid() Function"
        body = $issue1Content
        labels = @("P0", "critical", "race-condition", "bug")
        milestone = $phase1MilestoneId
    },
    @{
        title = "CRITICAL: Double Payment Vulnerability in Payment Modal"
        body = $issue2Content
        labels = @("P0", "critical", "payment", "security", "bug")
        milestone = $phase1MilestoneId
    },
    @{
        title = "HIGH: Security Exposure in Console Logs and Hardcoded Keys"
        body = $issue3Content
        labels = @("P1", "security", "bug")
        milestone = $phase1MilestoneId
    }
)

# Create issues
foreach ($issue in $issues) {
    try {
        # Build issue body carefully
        $issueData = @{
            title = $issue.title
            body = $issue.body
            labels = $issue.labels
        }
        
        # Only add milestone if it exists
        if ($issue.milestone) {
            $issueData.milestone = $issue.milestone
        }
        
        $issueBody = $issueData | ConvertTo-Json -Depth 3
        
        $response = Invoke-RestMethod -Uri "$baseUrl/issues" -Method POST -Headers $headers -Body $issueBody -ContentType "application/json"
        Write-Host "[SUCCESS] Created issue #$($response.number): $($issue.title)" -ForegroundColor Green
        Write-Host "          URL: $($response.html_url)" -ForegroundColor Cyan
    }
    catch {
        Write-Host "[ERROR] Failed to create issue '$($issue.title)'" -ForegroundColor Red
        Write-Host "        Error: $($_.Exception.Message)" -ForegroundColor Red
        
        # Try to get more detailed error info
        if ($_.Exception.Response) {
            try {
                $errorResponse = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($errorResponse)
                $errorDetails = $reader.ReadToEnd()
                Write-Host "        Details: $errorDetails" -ForegroundColor Red
            }
            catch {
                Write-Host "        Could not read error details" -ForegroundColor Red
            }
        }
    }
}

Write-Host "`nGitHub Issues Creation Complete!" -ForegroundColor Green
Write-Host "Visit your repository: https://github.com/$Owner/$Repo/issues" -ForegroundColor Cyan

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Review the created issues in your GitHub repository"
Write-Host "2. Start with Issue #2 (Race Condition) - highest priority" 
Write-Host "3. Follow the implementation guides in each issue"
Write-Host "4. Use the project milestones to track progress"

# Clean up test issue if it exists
Write-Host "`nCleaning up test issue..." -ForegroundColor Green
try {
    Invoke-RestMethod -Uri "$baseUrl/issues/1" -Method PATCH -Headers $headers -Body '{"state":"closed"}' -ContentType "application/json"
    Write-Host "[SUCCESS] Closed test issue #1" -ForegroundColor Green
}
catch {
    Write-Host "[INFO] Test issue #1 not found or already closed" -ForegroundColor Yellow
} 