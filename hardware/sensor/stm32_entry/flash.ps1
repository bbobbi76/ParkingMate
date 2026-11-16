$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot "..\python-tools.ps1")
$stmPython = Get-HardwarePython
& $stmPython -m platformio run --project-dir $PSScriptRoot
if ($LASTEXITCODE -ne 0) { throw 'STM32 build failed.' }
$boardVolumes = @(Get-Volume | Where-Object { $_.FileSystemLabel -eq 'NOD_F401RE' -and $_.DriveLetter })
if ($boardVolumes.Count -ne 1) { throw 'Connect exactly one NUCLEO-F401RE.' }
$boardDrive = '{0}:\' -f $boardVolumes[0].DriveLetter
if (-not (Test-Path -LiteralPath (Join-Path $boardDrive 'DETAILS.TXT'))) { throw 'Board identity file missing.' }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '.pio\build\nucleo_f401re\firmware.bin') -Destination (Join-Path $boardDrive 'firmware.bin')
Write-Output 'STM32 team firmware copied. Sensor inputs are D2/PA10 and D3/PB3.'
