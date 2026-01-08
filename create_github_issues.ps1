# GitHub Issues Creation Script
# Първо трябва да се логнеш: gh auth login --web

# Добави GitHub CLI в PATH
$env:PATH += ";C:\Program Files\GitHub CLI"

Write-Host "🚀 Starting GitHub Issues creation..." -ForegroundColor Green

# Проверка дали сме логнати
Write-Host "Checking GitHub authentication..." -ForegroundColor Yellow
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Not authenticated. Please run: gh auth login --web" -ForegroundColor Red
    exit 1
}

Write-Host "✅ GitHub authentication successful!" -ForegroundColor Green

# Стъпка 1: Създай labels
Write-Host "`n📊 Creating GitHub labels..." -ForegroundColor Yellow

$labels = @(
    @{name="P0"; color="d73a49"; description="Critical - Blocking production"},
    @{name="P1"; color="f66a0a"; description="High priority"},
    @{name="P2"; color="fbca04"; description="Medium priority"}, 
    @{name="P3"; color="0e8a16"; description="Low priority"},
    @{name="critical"; color="d73a49"; description="Critical issues"},
    @{name="bug"; color="d73a49"; description="Bug fixes"},
    @{name="security"; color="7057ff"; description="Security issues"},
    @{name="performance"; color="fbca04"; description="Performance issues"},
    @{name="optimization"; color="0e8a16"; description="Code optimization"},
    @{name="cleanup"; color="586069"; description="Maintenance work"},
    @{name="payment"; color="0075ca"; description="Payment related"},
    @{name="stripe"; color="0075ca"; description="Stripe integration"},
    @{name="admin-panel"; color="0075ca"; description="Admin panel specific"},
    @{name="mobile"; color="0075ca"; description="Mobile app specific"},
    @{name="GDPR"; color="7057ff"; description="GDPR compliance"}
)

foreach ($label in $labels) {
    try {
        gh label create $label.name --color $label.color --description $label.description 2>$null
        Write-Host "  ✅ Created label: $($label.name)" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠️  Label already exists: $($label.name)" -ForegroundColor Yellow
    }
}

# Стъпка 2: Създай milestones
Write-Host "`n🎯 Creating GitHub milestones..." -ForegroundColor Yellow

$milestones = @(
    @{title="Phase 1 - Critical Fixes"; description="Resolve blocking production issues"; dueDate="2024-12-31"},
    @{title="Phase 2 - Performance"; description="Optimize performance and reliability"; dueDate="2025-01-31"},
    @{title="Phase 3 - Optimizations"; description="Code quality and maintainability improvements"; dueDate="2025-02-28"},
    @{title="Phase 4 - Cleanup"; description="Project organization and maintenance"; dueDate="2025-03-15"}
)

foreach ($milestone in $milestones) {
    try {
        gh milestone create $milestone.title --description $milestone.description --due $milestone.dueDate 2>$null
        Write-Host "  ✅ Created milestone: $($milestone.title)" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠️  Milestone already exists: $($milestone.title)" -ForegroundColor Yellow
    }
}

# Стъпка 3: Създай критични issues
Write-Host "`n🔴 Creating critical GitHub issues..." -ForegroundColor Yellow

# Issue #1: Race Condition
Write-Host "Creating Issue #1: Race Condition..." -ForegroundColor Cyan
$issue1Title = "🔴 CRITICAL: Race condition при acceptBid() - множество clients могат да приемат различни bids"
$issue1Body = Get-Content -Path "github_issues/issue_01_race_condition.md" -Raw

try {
    $issue1 = gh issue create --title $issue1Title --body $issue1Body --label "critical,bug,security,P0" --milestone "Phase 1 - Critical Fixes"
    Write-Host "  ✅ Created Issue #1: $issue1" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Failed to create Issue #1: $($_.Exception.Message)" -ForegroundColor Red
}

# Issue #2: Double Payment
Write-Host "Creating Issue #2: Double Payment..." -ForegroundColor Cyan
$issue2Title = "🔴 CRITICAL: Потенциален double payment при payment modal"
$issue2Body = Get-Content -Path "github_issues/issue_02_double_payment.md" -Raw

try {
    $issue2 = gh issue create --title $issue2Title --body $issue2Body --label "critical,bug,payment,stripe,P0" --milestone "Phase 1 - Critical Fixes"
    Write-Host "  ✅ Created Issue #2: $issue2" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Failed to create Issue #2: $($_.Exception.Message)" -ForegroundColor Red
}

# Issue #3: Security Logging
Write-Host "Creating Issue #3: Security Logging..." -ForegroundColor Cyan
$issue3Title = "🔴 SECURITY: Sensitive data exposure в production logs"
$issue3Body = Get-Content -Path "github_issues/issue_03_security_logging.md" -Raw

try {
    $issue3 = gh issue create --title $issue3Title --body $issue3Body --label "security,critical,GDPR,P1" --milestone "Phase 1 - Critical Fixes"
    Write-Host "  ✅ Created Issue #3: $issue3" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Failed to create Issue #3: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 GitHub Issues creation completed!" -ForegroundColor Green
Write-Host "Visit: https://github.com/sashlex99/roadside-assistance/issues" -ForegroundColor Cyan

# Покажи summary
Write-Host "`n📊 Summary:" -ForegroundColor Yellow
gh issue list --limit 10 --state open 