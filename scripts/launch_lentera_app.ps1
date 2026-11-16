$ErrorActionPreference = "SilentlyContinue"
$RootDir = Split-Path -Parent $PSScriptRoot
$PortalDir = Join-Path $RootDir "Lentera-Portal"
$AppUrl = "http://localhost:3000"

function Test-PortOpen([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        $wait = $async.AsyncWaitHandle.WaitOne(400, $false)
        if ($wait -and $client.Connected) {
            $client.EndConnect($async)
            $client.Close()
            return $true
        }
    } catch {}
    $client.Close()
    return $false
}

# 1. Nyalakan server lokal Lentera-Portal di background jika belum aktif
if (-not (Test-PortOpen 3000)) {
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory $PortalDir -WindowStyle Hidden
    for ($i = 0; $i -lt 35; $i++) {
        Start-Sleep -Milliseconds 500
        if (Test-PortOpen 3000) {
            Start-Sleep -Milliseconds 600
            break
        }
    }
}

# 2. Cari runtime Desktop App (Edge WebView / Chrome App Mode) agar fitur Web Speech API Bahasa Indonesia & Mikrofon 100% berjalan
$BrowserCandidates = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$AppRunner = $BrowserCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($AppRunner) {
    Start-Process -FilePath $AppRunner -ArgumentList "--app=$AppUrl --window-size=1366,840"
} else {
    Start-Process $AppUrl
}

