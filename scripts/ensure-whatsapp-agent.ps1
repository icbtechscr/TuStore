$ErrorActionPreference = "Stop"
$launcher = (Resolve-Path (Join-Path $PSScriptRoot "whatsapp-agent-hidden.vbs")).Path

$running = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object {
    $_.CommandLine -and
    $_.CommandLine.IndexOf("whatsapp-agent.mjs", [System.StringComparison]::OrdinalIgnoreCase) -ge 0
  } |
  Select-Object -First 1

if (-not $running) {
  Start-Process -FilePath "wscript.exe" -ArgumentList ('"' + $launcher + '"') -WindowStyle Hidden
  Write-Output "Agente WhatsApp iniciado."
} else {
  Write-Output ("Agente WhatsApp activo (PID " + $running.ProcessId + ").")
}
