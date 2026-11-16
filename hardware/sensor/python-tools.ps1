function Get-HardwarePython {
    param([switch]$Windowed)
    $hardwareFolder = Split-Path -Parent $PSScriptRoot
    $name = if ($Windowed) { 'pythonw.exe' } else { 'python.exe' }
    $localPython = Join-Path $hardwareFolder ('.venv\Scripts\' + $name)
    if (Test-Path -LiteralPath $localPython) { return $localPython }
    $command = Get-Command $name -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    throw 'Run hardware/setup.cmd after installing Python 3.11 or newer.'
}
