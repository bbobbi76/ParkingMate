param([switch]$NoBrowser, [switch]$SkipHotspot)
$ErrorActionPreference = 'Stop'
$fieldUrl = 'http://127.0.0.1:9000/'
$runtimeFolder = Join-Path $PSScriptRoot 'field-runtime'
[IO.Directory]::CreateDirectory($runtimeFolder) | Out-Null
function Get-FieldState {
    try { return Invoke-RestMethod -Uri ($fieldUrl + 'api/monitor') -TimeoutSec 2 -ErrorAction Stop }
    catch { return $null }
}
function Open-FieldWindow {
    if ($NoBrowser) { return }
    $chromeCandidates = @((Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'))
    if (${env:ProgramFiles(x86)}) { $chromeCandidates += Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe' }
    $chromeCandidates += Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'
    $chrome = $chromeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if ($chrome) { Start-Process -FilePath $chrome -ArgumentList @('--new-window', $fieldUrl) }
    else { Start-Process $fieldUrl }
}
try {
    if (-not $SkipHotspot) {
        $hotspot = & (Join-Path $PSScriptRoot 'ensure-field-hotspot.ps1')
        [IO.File]::WriteAllText((Join-Path $runtimeFolder 'hotspot-status.json'), [string]$hotspot, (New-Object Text.UTF8Encoding($false)))
    }
    $existing = Get-FieldState
    if ($existing -and $existing.service -eq 'parkingmate-field-monitor-v1') {
        Open-FieldWindow
        Write-Output 'Field counter already running. Existing records preserved.'
        exit 0
    }
    $busyPort = Get-NetTCPConnection -LocalPort 9000 -State Listen -ErrorAction SilentlyContinue
    if ($busyPort) { throw '다른 센서 수신 프로그램이 실행 중입니다. 기존 수신 프로그램을 종료한 뒤 다시 실행하세요.' }
    . (Join-Path $PSScriptRoot "python-tools.ps1")
    $fieldPython = Get-HardwarePython
    & $fieldPython -c 'import serial, requests' 2>$null
    if ($LASTEXITCODE -ne 0) { throw '센서 실행 도구를 찾지 못했습니다. hardware/setup.cmd를 먼저 실행하세요.' }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $fieldArgs = @('-u', ('"' + (Join-Path $PSScriptRoot 'field_monitor.py') + '"'), '--serial', 'auto')
    $process = Start-Process -FilePath $fieldPython -ArgumentList $fieldArgs -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeFolder ($stamp + '.log')) -RedirectStandardError (Join-Path $runtimeFolder ($stamp + '.error.log'))
    $ready = $false
    for ($i=0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 300
        $state = Get-FieldState
        if ($state -and $state.service -eq 'parkingmate-field-monitor-v1') { $ready = $true; break }
        $process.Refresh()
        if ($process.HasExited) { break }
    }
    if (-not $ready) { throw '수신 프로그램을 시작하지 못했습니다. sensor\field-runtime의 최신 error.log를 확인하세요.' }
    Open-FieldWindow
    Write-Output ('Field counter ready: ' + $fieldUrl)
} catch {
    $message = $_.Exception.Message
    if (-not $NoBrowser) {
        Add-Type -AssemblyName PresentationFramework
        [System.Windows.MessageBox]::Show($message, 'ParkingMate 현장 테스트') | Out-Null
    }
    Write-Error $message
    exit 1
}
