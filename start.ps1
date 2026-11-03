param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$rootPath = [System.IO.Path]::GetFullPath($PSScriptRoot)
$serverPath = Join-Path $rootPath 'server.cjs'
$port = 18473
$url = "http://127.0.0.1:$port/"
$healthUrl = "http://127.0.0.1:$port/api/health"
$restMethodParameters = (Get-Command Invoke-RestMethod).Parameters
$script:RootHealthResponse = $null

function Test-RootHealth {
    try {
        $script:RootHealthResponse = $null
        $request = @{ Uri = $healthUrl; Method = 'Get'; UseBasicParsing = $true }
        if ($restMethodParameters.ContainsKey('ConnectionTimeoutSeconds')) {
            $request.ConnectionTimeoutSeconds = 1
            $request.OperationTimeoutSeconds = 1
        } else {
            $request.TimeoutSec = 1
        }
        $response = Invoke-RestMethod @request
        $script:RootHealthResponse = $response
        return ($response.app -eq 'ROOT' -and [int]$response.version -eq 3 -and $response.release -eq '1.5.1')
    } catch {
        return $false
    }
}

function Test-PortOpen {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $pending = $client.BeginConnect('127.0.0.1', $port, $null, $null)
        if (-not $pending.AsyncWaitHandle.WaitOne(500)) { return $false }
        try {
            $client.EndConnect($pending)
            return $true
        } catch {
            return $false
        }
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

if (Test-RootHealth) {
    if (-not $NoBrowser) { Start-Process $url }
    exit 0
}

if (Test-PortOpen) {
    if ($script:RootHealthResponse.app -eq 'ROOT') {
        Write-Host 'Eine veraltete ROOT-Instanz läuft noch. Beende den alten Server im Task-Manager und starte den aktualisierten ROOT-Launcher erneut.' -ForegroundColor Red
        exit 1
    }
    Write-Host "Port $port ist belegt, aber dort läuft kein ROOT-Server. Beende oder konfiguriere die andere Anwendung und starte ROOT erneut." -ForegroundColor Red
    exit 1
}

$node = Get-Command node.exe -ErrorAction SilentlyContinue
$nodePath = if ($node) { $node.Source } else { $null }
if (-not $nodePath) {
    Write-Host 'ROOT braucht Node.js 24 oder 26. node.exe wurde im PATH nicht gefunden.' -ForegroundColor Red
    Write-Host 'Installiere eine unterstützte Node.js-Version und füge node.exe zum PATH hinzu.'
    exit 1
}
if (-not (Test-Path -LiteralPath $serverPath -PathType Leaf)) {
    Write-Host "ROOT Server fehlt: $serverPath" -ForegroundColor Red
    exit 1
}

$dataPath = Join-Path $rootPath 'data'
New-Item -ItemType Directory -Force -Path $dataPath | Out-Null
$stdoutLog = Join-Path $dataPath 'server.out.log'
$stderrLog = Join-Path $dataPath 'server.err.log'
$quotedServerPath = '"' + $serverPath + '"'
$hadRootPort = Test-Path Env:ROOT_PORT
$oldRootPort = $env:ROOT_PORT
$hadRootDataDir = Test-Path Env:ROOT_DATA_DIR
$oldRootDataDir = $env:ROOT_DATA_DIR
try {
    $env:ROOT_PORT = [string]$port
    $env:ROOT_DATA_DIR = $dataPath
    $serverProcess = Start-Process -FilePath $nodePath -ArgumentList @($quotedServerPath) -WorkingDirectory $rootPath -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
} finally {
    if ($hadRootPort) { $env:ROOT_PORT = $oldRootPort } else { Remove-Item Env:ROOT_PORT -ErrorAction SilentlyContinue }
    if ($hadRootDataDir) { $env:ROOT_DATA_DIR = $oldRootDataDir } else { Remove-Item Env:ROOT_DATA_DIR -ErrorAction SilentlyContinue }
}

$healthy = $false
$timer = [System.Diagnostics.Stopwatch]::StartNew()
while ($timer.Elapsed.TotalSeconds -lt 10) {
    if ($serverProcess.HasExited) { break }
    if (Test-RootHealth) {
        $healthy = $true
        break
    }
    Start-Sleep -Milliseconds 250
}

if (-not $healthy) {
    if ($script:RootHealthResponse.app -eq 'ROOT') {
        Write-Host 'Eine veraltete ROOT-Instanz antwortet noch. Beende den alten Server und starte den aktualisierten ROOT-Launcher erneut.' -ForegroundColor Red
        exit 1
    }
    Write-Host 'ROOT konnte nicht innerhalb von 10 Sekunden starten.' -ForegroundColor Red
    foreach ($log in @($stderrLog, $stdoutLog)) {
        if (Test-Path -LiteralPath $log -PathType Leaf) {
            Write-Host "--- $([System.IO.Path]::GetFileName($log)) (letzte 20 Zeilen) ---"
            Get-Content -LiteralPath $log -Tail 20 -ErrorAction SilentlyContinue
        }
    }
    Write-Host 'Prüfe die oben gezeigten Meldungen und starte ROOT danach erneut.'
    exit 1
}

if (-not $NoBrowser) { Start-Process $url }
