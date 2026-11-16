$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot "..\python-tools.ps1")
$picoPython = Get-HardwarePython
& $picoPython (Join-Path $PSScriptRoot 'configure.py')
if ($LASTEXITCODE -ne 0) { throw 'Pico configuration/upload failed.' }
