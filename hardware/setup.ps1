$ErrorActionPreference = 'Stop'
$taskVenv = Join-Path $PSScriptRoot '.venv'
$taskPython = Join-Path $taskVenv 'Scripts\python.exe'
if (-not (Test-Path -LiteralPath $taskPython)) {
    $pyLauncher = Get-Command py -ErrorAction SilentlyContinue
    if ($pyLauncher) { & $pyLauncher.Source -3 -m venv $taskVenv }
    else { & python -m venv $taskVenv }
    if ($LASTEXITCODE -ne 0) { throw 'Python venv creation failed. Install Python 3.11 or newer with tkinter.' }
}
& $taskPython -m pip install --force-reinstall -r (Join-Path $PSScriptRoot 'sensor\requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
& $taskPython -c 'import tkinter, serial, requests'
if ($LASTEXITCODE -ne 0) { throw 'Python dependency check failed.' }
Write-Output 'Setup complete. Run web or field launcher.'
