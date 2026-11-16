param([string]$SerialPort = 'auto', [string]$Api = '', [switch]$CaptureOnly)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot "python-tools.ps1")
$bridgePython = Get-HardwarePython
$bridgeArgs = @('-u', (Join-Path $PSScriptRoot 'bridge.py'), '--serial', $SerialPort)
if ($Api) { $bridgeArgs += @('--api', $Api) }
if ($CaptureOnly) { $bridgeArgs += '--capture-only' }
& $bridgePython @bridgeArgs
if ($LASTEXITCODE -ne 0) { throw 'Bridge stopped with an error.' }
