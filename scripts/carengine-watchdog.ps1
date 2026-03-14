<#
.SYNOPSIS
    CarEngine Watchdog - Keeps Mono5 server (port 5000) + ngrok tunnel alive.

.DESCRIPTION
    Runs silently via Startup folder / Task Scheduler.
    - Auto-starts the Mono5 dev server on port 5000
    - Verifies ngrok carengine.ngrok.app tunnel is active
    - Health checks every 20 seconds
    - Auto-restarts crashed services
    - Daily log rotation
    - Mutex lock prevents duplicate instances

.NOTES
    Install via: scripts\install-service.bat  (run as Administrator)
    Logs at:     D:\Mono5\logs\
#>

param(
    [int]$Port              = 5000,
    [string]$ProjectDir     = 'D:\Mono5',
    [string]$NgrokDomain    = 'carengine.ngrok.app',
    [string]$NgrokExe       = 'C:\ngrok\ngrok.exe',
    [int]$CheckInterval     = 20,
    [int]$MaxConsecutiveFails = 3
)

$ErrorActionPreference = 'Continue'

# -- Paths --
$LogsDir  = Join-Path $ProjectDir 'logs'
$PidFile  = Join-Path $LogsDir 'carengine-watchdog.pid'
$Pm2Cmd   = Join-Path $env:APPDATA 'npm\pm2.cmd'

if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}

# -- Mutex --
$mutexName = 'Global\CarEngineWatchdogMutex'
$mutex = New-Object System.Threading.Mutex($false, $mutexName)
if (-not $mutex.WaitOne(0)) {
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -Path (Join-Path $LogsDir 'watchdog-service.log') -Value "[$ts] BLOCKED: Another instance already running. Exiting."
    exit 0
}

# -- Logging --
function Write-Log {
    param([string]$Level, [string]$Message)
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "[$ts] [$Level] $Message"
    $f = Join-Path $LogsDir 'watchdog-service.log'
    Add-Content -Path $f -Value $line
}

function Rotate-Logs {
    $cutoff = (Get-Date).AddDays(-7)
    Get-ChildItem -Path $LogsDir -Filter '*.log' -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt $cutoff } |
        Remove-Item -Force -ErrorAction SilentlyContinue

    $svcLog = Join-Path $LogsDir 'watchdog-service.log'
    if ((Test-Path $svcLog) -and (Get-Item $svcLog).Length -gt 10MB) {
        $tail = Get-Content $svcLog -Tail 1000
        $tail | Set-Content $svcLog
        Write-Log 'INFO' 'Rotated watchdog-service.log'
    }
}

# -- PID + banner --
Set-Content -Path $PidFile -Value $PID
Write-Log 'INFO' '======================================================='
$msg = 'CarEngine Watchdog starting  PID=' + $PID
Write-Log 'INFO' $msg
$msg = 'Port=' + $Port + ' Domain=' + $NgrokDomain + ' Interval=' + $CheckInterval + 's'
Write-Log 'INFO' $msg
Write-Log 'INFO' ('Project=' + $ProjectDir)
Write-Log 'INFO' '======================================================='

# -- State --
$script:serverProcess  = $null
$script:serverRestarts = 0
$script:ngrokRestarts  = 0
$script:startTime      = Get-Date
$script:lastLogRotation = Get-Date

# -- Helpers --
function Test-PortListening {
    param([int]$P)
    try {
        $c = Get-NetTCPConnection -LocalPort $P -ErrorAction SilentlyContinue
        return ($null -ne $c)
    } catch { return $false }
}

function Test-ServerHealth {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$Port" -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
        return ($r.StatusCode -lt 500)
    } catch {
        return $false
    }
}

function Test-NgrokTunnel {
    foreach ($apiPort in @(4040, 4041)) {
        try {
            $status = Invoke-RestMethod -Uri "http://127.0.0.1:${apiPort}/api/tunnels" -TimeoutSec 5 -ErrorAction Stop
            foreach ($t in $status.tunnels) {
                if ($t.public_url -match $NgrokDomain) { return $true }
            }
        } catch {}
    }
    return $false
}

# -- Start App Server --
function Start-AppServer {
    Write-Log 'INFO' 'Starting Mono5 server on port...'

    # Kill existing on port
    $existing = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($p in $existing) {
        if ($p -and $p -ne 0) {
            Write-Log 'WARN' ('Killing PID ' + $p + ' on port ' + $Port)
            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
    }

    # Try PM2 first
    $usePm2 = $false
    if (Test-Path $Pm2Cmd) {
        try {
            $env:PM2_HOME = Join-Path $env:USERPROFILE '.pm2'
            & $Pm2Cmd resurrect 2>&1 | Out-Null
            Start-Sleep -Seconds 3

            $pm2Json = & $Pm2Cmd jlist 2>&1
            $pm2List = $pm2Json | ConvertFrom-Json -ErrorAction Stop
            $mono5 = $pm2List | Where-Object { $_.name -eq 'mono5-server' }
            if ($mono5) {
                & $Pm2Cmd restart 'mono5-server' 2>&1 | Out-Null
                $usePm2 = $true
                Write-Log 'INFO' 'Started via PM2 mono5-server'
            }
        } catch {
            $emsg = $_.Exception.Message
            Write-Log 'WARN' ('PM2 failed: ' + $emsg + ' - falling back to direct start')
        }
    }

    if (-not $usePm2) {
        $stdout = Join-Path $LogsDir 'server-stdout.log'
        $stderr = Join-Path $LogsDir 'server-stderr.log'

        # Write a batch file so we avoid ampersand issues in PS 5.1
        $batchFile = Join-Path $LogsDir 'start-server.cmd'
        $batchLines = @(
            '@echo off',
            ('cd /d "' + $ProjectDir + '"'),
            'set NODE_ENV=development',
            ('npx tsx server/index.ts > "' + $stdout + '" 2> "' + $stderr + '"')
        )
        $batchLines | Set-Content -Path $batchFile -Encoding ASCII

        $script:serverProcess = Start-Process -FilePath 'cmd.exe' `
            -ArgumentList '/c', $batchFile `
            -WindowStyle Hidden -PassThru

        $spid = $script:serverProcess.Id
        Write-Log 'INFO' ('Started via cmd.exe PID=' + $spid)
    }

    $script:serverRestarts++

    # Wait for port
    $waited = 0
    $maxWait = 90
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 3
        $waited += 3
        if (Test-PortListening $Port) {
            $rn = $script:serverRestarts
            Write-Log 'OK' ('Server UP on port ' + $Port + ' waited=' + $waited + 's restart=#' + $rn)
            return $true
        }
        if ($script:serverProcess -and $script:serverProcess.HasExited) {
            $ec = $script:serverProcess.ExitCode
            Write-Log 'ERROR' ('Server process exited with code ' + $ec)
            return $false
        }
    }

    Write-Log 'ERROR' ('Server failed to start within ' + $maxWait + 's')
    return $false
}

# -- Start ngrok (via Windows service only — never standalone) --
function Start-NgrokTunnel {
    Write-Log 'INFO' 'Restarting ngrok via Windows service...'

    # Kill only standalone ngrok processes (not the service process)
    $svcPid = $null
    try {
        $svcObj = Get-WmiObject Win32_Service -Filter "Name='ngrok'" -ErrorAction SilentlyContinue
        if ($svcObj -and $svcObj.ProcessId -ne 0) { $svcPid = $svcObj.ProcessId }
    } catch {}
    Get-Process -Name 'ngrok' -ErrorAction SilentlyContinue |
        Where-Object { $_.Id -ne $svcPid } |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3

    # Restart ngrok Windows service (elevated)
    try {
        Start-Process -FilePath 'powershell.exe' `
            -ArgumentList '-NoProfile','-Command','Restart-Service ngrok -Force' `
            -Verb RunAs -Wait -WindowStyle Hidden
        Write-Log 'INFO' 'Restarted ngrok Windows service'
    } catch {
        $emsg = $_.Exception.Message
        Write-Log 'ERROR' ('Failed to restart ngrok service: ' + $emsg)
        return $false
    }

    $script:ngrokRestarts++

    # Wait for tunnel
    $waited = 0
    while ($waited -lt 30) {
        Start-Sleep -Seconds 2
        $waited += 2
        if (Test-NgrokTunnel) {
            $rn = $script:ngrokRestarts
            Write-Log 'OK' ('ngrok tunnel ' + $NgrokDomain + ' is UP restart=#' + $rn)
            return $true
        }
    }

    $ngrokProc = Get-Process -Name 'ngrok' -ErrorAction SilentlyContinue
    if ($ngrokProc) {
        $npid = $ngrokProc.Id
        Write-Log 'WARN' ('ngrok process alive but tunnel not verified PID=' + $npid)
        return $true
    }

    Write-Log 'ERROR' 'ngrok tunnel failed to start within 30s'
    return $false
}

# -- Cleanup --
function Cleanup {
    Write-Log 'INFO' 'Watchdog shutting down...'
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    try { $mutex.ReleaseMutex() } catch {}
    try { $mutex.Dispose() } catch {}
    $uptime = (Get-Date) - $script:startTime
    $h = [math]::Floor($uptime.TotalHours)
    $m = $uptime.Minutes
    $sr = $script:serverRestarts
    $nr = $script:ngrokRestarts
    Write-Log 'INFO' ('Uptime=' + $h + 'h' + $m + 'm ServerRestarts=' + $sr + ' NgrokRestarts=' + $nr)
    Write-Log 'INFO' '======================================================='
}

Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Cleanup } -ErrorAction SilentlyContinue | Out-Null

# -- Initial Start --
Start-Sleep -Seconds 10

$serverUp = Test-PortListening $Port
if ($serverUp) {
    Write-Log 'OK' ('Server already running on port ' + $Port)
} else {
    Start-AppServer
}

Start-Sleep -Seconds 2

$ngrokUp = Test-NgrokTunnel
if ($ngrokUp) {
    Write-Log 'OK' ('ngrok tunnel ' + $NgrokDomain + ' already active')
} else {
    Start-NgrokTunnel
}

Write-Log 'INFO' 'Initialization complete. Entering health check loop...'

# -- Main Loop --
$consecutiveServerFails = 0
$consecutiveNgrokFails  = 0
$checkCount = 0

try {
    while ($true) {
        Start-Sleep -Seconds $CheckInterval
        $checkCount++

        # Check Server
        $serverOk = Test-ServerHealth
        if ($serverOk) {
            $consecutiveServerFails = 0
        } else {
            $consecutiveServerFails++
            Write-Log 'WARN' ('Server check failed ' + $consecutiveServerFails + ' of ' + $MaxConsecutiveFails)

            if ($consecutiveServerFails -ge $MaxConsecutiveFails) {
                Write-Log 'ERROR' 'Server DOWN - restarting...'
                Start-AppServer
                $consecutiveServerFails = 0
                Start-Sleep -Seconds 5
            }
        }

        # Check ngrok
        $ngrokOk = Test-NgrokTunnel
        if ($ngrokOk) {
            $consecutiveNgrokFails = 0
        } else {
            $consecutiveNgrokFails++
            Write-Log 'WARN' ('ngrok check failed ' + $consecutiveNgrokFails + ' of ' + $MaxConsecutiveFails)

            if ($consecutiveNgrokFails -ge $MaxConsecutiveFails) {
                Write-Log 'ERROR' 'ngrok tunnel DOWN - restarting...'
                Start-NgrokTunnel
                $consecutiveNgrokFails = 0
                Start-Sleep -Seconds 5
            }
        }

        # Log rotation daily
        if ((Get-Date) - $script:lastLogRotation -gt [TimeSpan]::FromHours(24)) {
            Rotate-Logs
            $script:lastLogRotation = Get-Date
        }

        # Heartbeat every ~5 min
        if ($checkCount % 15 -eq 0) {
            $uptime = (Get-Date) - $script:startTime
            $h = [math]::Floor($uptime.TotalHours)
            $m = $uptime.Minutes
            $sState = 'UP'; if (-not $serverOk) { $sState = 'DOWN' }
            $nState = 'UP'; if (-not $ngrokOk)  { $nState = 'DOWN' }
            $sr = $script:serverRestarts
            $nr = $script:ngrokRestarts
            Write-Log 'INFO' ('Heartbeat Server=' + $sState + ' ngrok=' + $nState + ' Uptime=' + $h + 'h' + $m + 'm Restarts=server:' + $sr + ' ngrok:' + $nr)
        }
    }
} catch {
    $emsg = $_.Exception.Message
    $stk  = $_.ScriptStackTrace
    Write-Log 'ERROR' ('Unhandled exception: ' + $emsg)
    Write-Log 'ERROR' ('Stack: ' + $stk)
} finally {
    Cleanup
}
