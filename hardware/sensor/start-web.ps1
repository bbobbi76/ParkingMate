$ErrorActionPreference = 'Stop'
try {
    . (Join-Path $PSScriptRoot "python-tools.ps1")
    $webPython = Get-HardwarePython -Windowed
    Start-Process -FilePath $webPython -ArgumentList ('"' + (Join-Path $PSScriptRoot 'web_connect.py') + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
} catch {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show('Python 실행 도구를 찾지 못했습니다. hardware/setup.cmd를 먼저 실행하세요.', 'ParkingMate 웹 연결') | Out-Null
    exit 1
}
