$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$networkInfo = [Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]
$tetheringType = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]
$resultType = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]
$bandType = [Windows.Networking.NetworkOperators.TetheringWiFiBand,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]
function Wait-FieldAction($Operation) {
    $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and -not $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.FullName -eq 'Windows.Foundation.IAsyncAction'
    } | Select-Object -First 1
    $task = $method.Invoke($null, @($Operation))
    if (-not $task.Wait(15000)) { throw 'Hotspot configuration timed out.' }
    $task.GetAwaiter().GetResult() | Out-Null
}
function Wait-FieldResult($Operation) {
    $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    } | Select-Object -First 1
    $task = $method.MakeGenericMethod($resultType).Invoke($null, @($Operation))
    if (-not $task.Wait(20000)) { throw 'Hotspot start timed out.' }
    return $task.GetAwaiter().GetResult()
}
try {
    $profiles = @($networkInfo::GetInternetConnectionProfile()) + @($networkInfo::GetConnectionProfiles())
    $manager = $null
    foreach ($profile in $profiles) {
        if (-not $profile) { continue }
        try {
            if ($tetheringType::GetTetheringCapabilityFromConnectionProfile($profile).ToString() -eq 'Enabled') {
                $candidate = $tetheringType::CreateFromConnectionProfile($profile)
                if ($candidate.TetheringOperationalState.ToString() -eq 'On') { $manager = $candidate; break }
                if (-not $manager -and $profile.GetNetworkConnectivityLevel().ToString() -ne 'None') { $manager = $candidate }
            }
        } catch { continue }
    }
    if (-not $manager) { throw 'No usable connection profile. Open Windows Mobile Hotspot settings.' }
    if ($manager.TetheringOperationalState.ToString() -eq 'Off') {
        $config = $manager.GetCurrentAccessPointConfiguration()
        if (-not $config.Ssid -or -not $config.Passphrase) { throw 'Configure the existing Pico hotspot in Windows first.' }
        if ($config.Band.ToString() -ne 'TwoPointFourGigahertz') {
            $config.Band = $bandType::TwoPointFourGigahertz
            Wait-FieldAction ($manager.ConfigureAccessPointAsync($config))
        }
        $result = Wait-FieldResult ($manager.StartTetheringAsync())
        if ($result.Status.ToString() -ne 'Success') { throw ('Hotspot start failed: ' + $result.Status.ToString()) }
    }
    [pscustomobject]@{State=$manager.TetheringOperationalState.ToString();Band=$manager.GetCurrentAccessPointConfiguration().Band.ToString();Clients=$manager.ClientCount} | ConvertTo-Json -Compress
} catch {
    [pscustomobject]@{State='Unavailable';Message=$_.Exception.Message} | ConvertTo-Json -Compress
}
