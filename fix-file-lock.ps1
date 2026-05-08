# Fix File Lock Issues - Windows Defender Exclusions
# This script must be run as Administrator

Write-Host "=== File Lock Fix Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator', then run this script again." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Project directory
$projectPath = "D:\INTERNSHIP\dragindrop"
$kiroExePath = "D:\Applications\Kiro\Kiro.exe"

Write-Host "Adding Windows Defender exclusions..." -ForegroundColor Green
Write-Host ""

try {
    # Add project directory exclusion
    Write-Host "1. Excluding project directory: $projectPath"
    Add-MpPreference -ExclusionPath $projectPath -ErrorAction Stop
    
    # Add Kiro executable exclusion
    if (Test-Path $kiroExePath) {
        Write-Host "2. Excluding Kiro executable: $kiroExePath"
        Add-MpPreference -ExclusionProcess $kiroExePath -ErrorAction Stop
    } else {
        Write-Host "2. Kiro executable not found at: $kiroExePath (skipping)" -ForegroundColor Yellow
    }
    
    # Add .kiro directory exclusion specifically
    $kiroDir = Join-Path $projectPath ".kiro"
    Write-Host "3. Excluding .kiro directory: $kiroDir"
    Add-MpPreference -ExclusionPath $kiroDir -ErrorAction Stop
    
    Write-Host ""
    Write-Host "SUCCESS: Windows Defender exclusions added!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Exclusions added:" -ForegroundColor Cyan
    Write-Host "  - $projectPath" -ForegroundColor White
    Write-Host "  - $kiroDir" -ForegroundColor White
    if (Test-Path $kiroExePath) {
        Write-Host "  - $kiroExePath" -ForegroundColor White
    }
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to add exclusions" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "=== Additional Recommendations ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Restart Kiro IDE completely (close all windows)" -ForegroundColor Yellow
Write-Host "2. If issues persist, restart your computer" -ForegroundColor Yellow
Write-Host "3. Check if Controlled Folder Access is enabled:" -ForegroundColor Yellow
Write-Host "   Windows Security > Virus & threat protection > Ransomware protection" -ForegroundColor White
Write-Host "   If enabled, add Kiro.exe as an allowed app" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter to exit"
